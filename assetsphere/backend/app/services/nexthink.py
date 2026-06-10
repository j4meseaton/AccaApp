"""
NextThink API client.

NextThink Infinity exposes a REST API protected by OAuth2 client credentials.
This client fetches an access token, then calls the Infinity API to pull
software inventory and usage data.

API Reference: https://docs.nexthink.com/platform/latest/nexthink-api
"""

import logging
import time
from typing import Any, TypedDict

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SoftwareInventoryItem(TypedDict):
    name: str
    vendor: str
    version: str
    device_count: int
    active_user_count: int
    last_seen: str  # ISO 8601


class DeviceUsageRecord(TypedDict):
    device_name: str
    user: str
    department: str
    last_used: str  # ISO 8601
    usage_minutes_30d: int


class DeviceRecord(TypedDict):
    device_id: str
    device_name: str
    os: str
    os_version: str
    user: str
    department: str
    last_seen: str
    managed: bool


class NextThinkClient:
    """
    Async HTTP client for the NextThink Infinity REST API.

    Token lifecycle: fetched once, cached until expiry, then refreshed
    automatically on the next request.
    """

    _token: str | None = None
    _token_expires_at: float = 0.0

    def __init__(self) -> None:
        self.base_url = settings.NEXTHINK_BASE_URL.rstrip("/")
        self.client_id = settings.NEXTHINK_CLIENT_ID
        self.client_secret = settings.NEXTHINK_CLIENT_SECRET
        self._http = httpx.AsyncClient(
            timeout=30,
            headers={"Content-Type": "application/json"},
        )

    # ── Auth ──────────────────────────────────────────────────────────────────

    async def _get_token(self) -> str:
        """Return a valid OAuth2 access token, refreshing if necessary."""
        if self._token and time.monotonic() < self._token_expires_at - 60:
            return self._token

        token_url = f"{self.base_url}/api/v1/token"
        resp = await self._http.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        data = resp.json()

        self._token = data["access_token"]
        expires_in: int = data.get("expires_in", 3600)
        self._token_expires_at = time.monotonic() + expires_in

        logger.debug("NextThink token refreshed, expires in %ds", expires_in)
        return self._token  # type: ignore[return-value]

    async def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {await self._get_token()}"}

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _paginate(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        page_size: int = 200,
    ) -> list[dict[str, Any]]:
        """
        Generic paginator for NextThink list endpoints.

        NextThink uses `offset` / `limit` query parameters and returns:
        {
          "data": [...],
          "pagination": {"total": N, "offset": 0, "limit": 200}
        }
        """
        params = params or {}
        params["limit"] = page_size
        params["offset"] = 0
        results: list[dict[str, Any]] = []

        while True:
            headers = await self._auth_headers()
            resp = await self._http.get(url, params=params, headers=headers)
            resp.raise_for_status()
            body = resp.json()

            page_data: list[dict[str, Any]] = body.get("data", [])
            results.extend(page_data)

            pagination = body.get("pagination", {})
            total: int = pagination.get("total", len(results))

            if len(results) >= total or not page_data:
                break

            params["offset"] += page_size
            logger.debug("NextThink paginator: fetched %d/%d", len(results), total)

        return results

    # ── Public methods ─────────────────────────────────────────────────────────

    async def get_software_inventory(self) -> list[SoftwareInventoryItem]:
        """
        Fetch the full software inventory from NextThink.

        Returns a list of installed software products with device & user counts.
        """
        url = f"{self.base_url}/api/v1/software"
        raw = await self._paginate(url, params={"includeUsage": "true"})

        inventory: list[SoftwareInventoryItem] = []
        for item in raw:
            inventory.append(
                SoftwareInventoryItem(
                    name=item.get("name", ""),
                    vendor=item.get("vendor", ""),
                    version=item.get("version", ""),
                    device_count=item.get("deviceCount", 0),
                    active_user_count=item.get("activeUserCount", 0),
                    last_seen=item.get("lastSeen", ""),
                )
            )
        logger.info("NextThink: fetched %d software inventory items", len(inventory))
        return inventory

    async def get_device_usage(self, software_name: str) -> list[DeviceUsageRecord]:
        """
        Fetch per-device usage data for a specific software title.

        Args:
            software_name: The exact software name as returned by NextThink.

        Returns:
            List of usage records, one per device/user combination.
        """
        url = f"{self.base_url}/api/v1/software/usage"
        raw = await self._paginate(
            url,
            params={"softwareName": software_name, "period": "30d"},
        )

        records: list[DeviceUsageRecord] = []
        for item in raw:
            records.append(
                DeviceUsageRecord(
                    device_name=item.get("deviceName", ""),
                    user=item.get("user", ""),
                    department=item.get("department", ""),
                    last_used=item.get("lastUsed", ""),
                    usage_minutes_30d=item.get("usageMinutes30d", 0),
                )
            )
        return records

    async def get_all_devices(self) -> list[DeviceRecord]:
        """
        Fetch all managed devices from NextThink.

        Useful for asset discovery — identifies devices that may not yet be
        registered in AssetSphere.
        """
        url = f"{self.base_url}/api/v1/devices"
        raw = await self._paginate(url)

        devices: list[DeviceRecord] = []
        for item in raw:
            devices.append(
                DeviceRecord(
                    device_id=item.get("id", ""),
                    device_name=item.get("name", ""),
                    os=item.get("os", ""),
                    os_version=item.get("osVersion", ""),
                    user=item.get("user", ""),
                    department=item.get("department", ""),
                    last_seen=item.get("lastSeen", ""),
                    managed=item.get("managed", True),
                )
            )
        logger.info("NextThink: fetched %d devices", len(devices))
        return devices

    async def close(self) -> None:
        await self._http.aclose()

    # ── Context manager support ───────────────────────────────────────────────
    async def __aenter__(self) -> "NextThinkClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()


# ── Module-level singleton (lazy) ─────────────────────────────────────────────
_client: NextThinkClient | None = None


def get_nexthink_client() -> NextThinkClient:
    global _client
    if _client is None:
        _client = NextThinkClient()
    return _client
