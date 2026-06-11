"""
Microsoft Intune / Graph API client.

Uses the Microsoft Graph API (https://graph.microsoft.com/v1.0) with an
OAuth2 client credentials token obtained via MSAL.

Relevant Graph endpoints:
  - /deviceAppManagement/mobileApps           → managed apps catalogue
  - /deviceManagement/detectedApps            → software detected on devices
  - /deviceManagement/managedDevices          → enrolled device inventory

Docs: https://learn.microsoft.com/en-us/graph/api/overview
"""

import logging
import time
from typing import Any, TypedDict

import httpx
import msal

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPES = ["https://graph.microsoft.com/.default"]


# ── Typed dicts ────────────────────────────────────────────────────────────────

class ManagedApp(TypedDict):
    id: str
    display_name: str
    publisher: str
    app_type: str
    is_featured: bool
    privacy_information_url: str
    created_at: str


class DetectedApp(TypedDict):
    id: str
    display_name: str
    version: str
    size_in_byte: int
    device_count: int
    platform: str


class ManagedDevice(TypedDict):
    id: str
    device_name: str
    user_principal_name: str
    operating_system: str
    os_version: str
    compliance_state: str
    enrollment_state: str
    last_sync_date_time: str
    manufacturer: str
    model: str
    serial_number: str


class IntuneClient:
    """
    Async Microsoft Graph / Intune client.

    Token acquisition is handled by MSAL's `ConfidentialClientApplication`
    which manages token caching transparently.
    """

    def __init__(self) -> None:
        tenant_id = settings.INTUNE_TENANT_ID or settings.AZURE_TENANT_ID
        authority = f"https://login.microsoftonline.com/{tenant_id}"

        self._msal_app = msal.ConfidentialClientApplication(
            client_id=settings.AZURE_CLIENT_ID,
            client_credential=settings.AZURE_CLIENT_SECRET,
            authority=authority,
        )
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._http = httpx.AsyncClient(
            base_url=GRAPH_BASE,
            timeout=30,
        )

    # ── Token acquisition ─────────────────────────────────────────────────────

    def _get_token(self) -> str:
        """Acquire a Graph API access token via MSAL client credentials."""
        now = time.monotonic()
        if self._token and now < self._token_expires_at - 60:
            return self._token

        # Try the cache first
        result = self._msal_app.acquire_token_silent(GRAPH_SCOPES, account=None)
        if not result or "access_token" not in result:
            result = self._msal_app.acquire_token_for_client(scopes=GRAPH_SCOPES)

        if "error" in result:
            raise RuntimeError(
                f"MSAL token error: {result['error']} — {result.get('error_description')}"
            )

        self._token = result["access_token"]
        self._token_expires_at = now + result.get("expires_in", 3600)
        logger.debug("Intune/Graph token acquired, expires in %ds", result.get("expires_in"))
        return self._token  # type: ignore[return-value]

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._get_token()}"}

    # ── Graph pagination helper ───────────────────────────────────────────────

    async def _paginate(self, path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """
        Follow OData @odata.nextLink pagination until all pages are consumed.

        Args:
            path:   Graph API path relative to GRAPH_BASE (e.g. "/deviceManagement/managedDevices").
            params: Initial query parameters.

        Returns:
            Merged list of all result objects.
        """
        results: list[dict[str, Any]] = []
        url: str | None = path

        # Build initial params — prefer $top=999 for fewer round-trips
        request_params: dict[str, Any] = {"$top": 999}
        if params:
            request_params.update(params)

        while url:
            headers = self._auth_headers()
            if url.startswith("http"):
                # nextLink is an absolute URL; make raw request
                resp = await self._http.get(url, headers=headers)
            else:
                resp = await self._http.get(url, params=request_params, headers=headers)
                request_params = {}  # params only needed on the first request

            resp.raise_for_status()
            body = resp.json()
            page_data: list[dict[str, Any]] = body.get("value", [])
            results.extend(page_data)

            url = body.get("@odata.nextLink")
            logger.debug("Graph paginator: %d records so far, nextLink=%s", len(results), bool(url))

        return results

    # ── Public methods ─────────────────────────────────────────────────────────

    async def get_managed_apps(self) -> list[ManagedApp]:
        """
        Retrieve the managed mobile app catalogue from Intune.

        Returns apps configured in the Intune app catalogue (not per-device).
        """
        raw = await self._paginate(
            "/deviceAppManagement/mobileApps",
            params={"$select": "id,displayName,publisher,@odata.type,isFeatured,privacyInformationUrl,createdDateTime"},
        )

        apps: list[ManagedApp] = []
        for item in raw:
            apps.append(
                ManagedApp(
                    id=item.get("id", ""),
                    display_name=item.get("displayName", ""),
                    publisher=item.get("publisher", ""),
                    app_type=item.get("@odata.type", "").lstrip("#"),
                    is_featured=item.get("isFeatured", False),
                    privacy_information_url=item.get("privacyInformationUrl", ""),
                    created_at=item.get("createdDateTime", ""),
                )
            )
        logger.info("Intune: fetched %d managed apps", len(apps))
        return apps

    async def get_detected_apps(self) -> list[DetectedApp]:
        """
        Retrieve software detected across all managed devices.

        This gives a real-world view of what is actually installed, including
        apps that were not pushed via Intune.
        """
        raw = await self._paginate(
            "/deviceManagement/detectedApps",
            params={
                "$select": "id,displayName,version,sizeInByte,deviceCount,platform"
            },
        )

        apps: list[DetectedApp] = []
        for item in raw:
            apps.append(
                DetectedApp(
                    id=item.get("id", ""),
                    display_name=item.get("displayName", ""),
                    version=item.get("version", ""),
                    size_in_byte=item.get("sizeInByte", 0),
                    device_count=item.get("deviceCount", 0),
                    platform=item.get("platform", ""),
                )
            )
        logger.info("Intune: fetched %d detected apps", len(apps))
        return apps

    async def get_devices(self) -> list[ManagedDevice]:
        """
        Retrieve all Intune-managed devices.

        Returns enrollment state, compliance, OS info, and hardware identifiers.
        """
        raw = await self._paginate(
            "/deviceManagement/managedDevices",
            params={
                "$select": (
                    "id,deviceName,userPrincipalName,operatingSystem,"
                    "osVersion,complianceState,enrollmentState,"
                    "lastSyncDateTime,manufacturer,model,serialNumber"
                )
            },
        )

        devices: list[ManagedDevice] = []
        for item in raw:
            devices.append(
                ManagedDevice(
                    id=item.get("id", ""),
                    device_name=item.get("deviceName", ""),
                    user_principal_name=item.get("userPrincipalName", ""),
                    operating_system=item.get("operatingSystem", ""),
                    os_version=item.get("osVersion", ""),
                    compliance_state=item.get("complianceState", ""),
                    enrollment_state=item.get("enrollmentState", ""),
                    last_sync_date_time=item.get("lastSyncDateTime", ""),
                    manufacturer=item.get("manufacturer", ""),
                    model=item.get("model", ""),
                    serial_number=item.get("serialNumber", ""),
                )
            )
        logger.info("Intune: fetched %d managed devices", len(devices))
        return devices

    async def get_detected_apps_for_device(self, device_id: str) -> list[dict[str, Any]]:
        """
        Fetch detected apps installed on a specific managed device.

        Args:
            device_id: Intune device ID.
        """
        raw = await self._paginate(
            f"/deviceManagement/managedDevices/{device_id}/detectedApps"
        )
        return raw

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "IntuneClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()


# ── Module-level singleton ────────────────────────────────────────────────────
_client: IntuneClient | None = None


def get_intune_client() -> IntuneClient:
    global _client
    if _client is None:
        _client = IntuneClient()
    return _client
