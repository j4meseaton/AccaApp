"""
ServiceNow API client.

Uses the ServiceNow Table API (REST) with HTTP Basic Authentication.
Supports:
  - Reading CMDB CI records
  - Creating Incidents and Change Requests
  - Syncing asset records as CIs

API docs: https://docs.servicenow.com/bundle/washingtondc-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html
"""

import logging
from base64 import b64encode
from typing import Any, TypedDict
from uuid import UUID

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Typed dicts ────────────────────────────────────────────────────────────────

class CMDBRecord(TypedDict):
    sys_id: str
    name: str
    asset_tag: str
    serial_number: str
    manufacturer: str
    model_number: str
    department: str
    assigned_to: str
    install_status: str
    sys_updated_on: str


class SnowTicket(TypedDict):
    sys_id: str
    number: str
    state: str
    short_description: str
    created_on: str


class ServiceNowClient:
    """
    Async ServiceNow REST client.

    Authentication: HTTP Basic Auth (username:password → Base64 header).
    For OAuth, replace `_auth_headers` with an OAuth token exchange.
    """

    def __init__(self) -> None:
        self.base_url = settings.SERVICENOW_BASE_URL.rstrip("/")
        _credentials = b64encode(
            f"{settings.SERVICENOW_USERNAME}:{settings.SERVICENOW_PASSWORD}".encode()
        ).decode()
        self._http = httpx.AsyncClient(
            timeout=30,
            headers={
                "Authorization": f"Basic {_credentials}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

    # ── Table API helpers ─────────────────────────────────────────────────────

    async def _table_get(
        self,
        table: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        GET records from a ServiceNow table with optional sysparm_query.

        Handles the 10 000-record limit by paginating via sysparm_offset.
        """
        params = params or {}
        params.setdefault("sysparm_limit", 1000)
        params.setdefault("sysparm_display_value", "false")
        offset = 0
        results: list[dict[str, Any]] = []

        while True:
            params["sysparm_offset"] = offset
            resp = await self._http.get(
                f"{self.base_url}/api/now/table/{table}", params=params
            )
            resp.raise_for_status()
            page: list[dict[str, Any]] = resp.json().get("result", [])
            results.extend(page)

            if len(page) < params["sysparm_limit"]:
                break
            offset += params["sysparm_limit"]
            logger.debug("ServiceNow paginator: fetched %d %s records so far", len(results), table)

        return results

    async def _table_post(
        self,
        table: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        resp = await self._http.post(
            f"{self.base_url}/api/now/table/{table}", json=payload
        )
        resp.raise_for_status()
        return resp.json().get("result", {})

    async def _table_put(
        self,
        table: str,
        sys_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        resp = await self._http.put(
            f"{self.base_url}/api/now/table/{table}/{sys_id}", json=payload
        )
        resp.raise_for_status()
        return resp.json().get("result", {})

    # ── Public methods ─────────────────────────────────────────────────────────

    async def get_cmdb_records(
        self,
        table: str = "cmdb_ci_computer",
        query: str | None = None,
    ) -> list[CMDBRecord]:
        """
        Retrieve CI records from the CMDB.

        Args:
            table:  ServiceNow table name (e.g. cmdb_ci_computer, cmdb_ci_appl).
            query:  Encoded sysparm_query string, e.g. "install_status=1^active=true".

        Returns:
            List of normalised CMDBRecord dicts.
        """
        params: dict[str, Any] = {
            "sysparm_fields": (
                "sys_id,name,asset_tag,serial_number,manufacturer,"
                "model_number,department,assigned_to,install_status,sys_updated_on"
            ),
        }
        if query:
            params["sysparm_query"] = query

        raw = await self._table_get(table, params)

        records: list[CMDBRecord] = []
        for item in raw:
            records.append(
                CMDBRecord(
                    sys_id=item.get("sys_id", ""),
                    name=item.get("name", ""),
                    asset_tag=item.get("asset_tag", ""),
                    serial_number=item.get("serial_number", ""),
                    manufacturer=item.get("manufacturer", ""),
                    model_number=item.get("model_number", ""),
                    department=item.get("department", ""),
                    assigned_to=item.get("assigned_to", {}).get("display_value", "")
                    if isinstance(item.get("assigned_to"), dict)
                    else item.get("assigned_to", ""),
                    install_status=item.get("install_status", ""),
                    sys_updated_on=item.get("sys_updated_on", ""),
                )
            )
        logger.info("ServiceNow: fetched %d CMDB records from %s", len(records), table)
        return records

    async def create_incident(
        self,
        short_desc: str,
        description: str,
        asset_id: UUID | str | None = None,
        urgency: int = 3,
        impact: int = 3,
        category: str = "software",
    ) -> SnowTicket:
        """
        Open a ServiceNow Incident.

        Args:
            short_desc:  One-line summary.
            description: Detailed description.
            asset_id:    AssetSphere UUID — stored in the work notes.
            urgency:     1 (Critical) – 4 (Planning).
            impact:      1 (Enterprise) – 3 (Individual).
            category:    Incident category string.

        Returns:
            SnowTicket with sys_id, number, state, etc.
        """
        payload: dict[str, Any] = {
            "short_description": short_desc,
            "description": description,
            "urgency": str(urgency),
            "impact": str(impact),
            "category": category,
            "caller_id": settings.SERVICENOW_USERNAME,
        }
        if asset_id:
            payload["work_notes"] = f"AssetSphere asset_id: {asset_id}"

        result = await self._table_post("incident", payload)
        logger.info(
            "ServiceNow: created incident %s for asset %s",
            result.get("number"),
            asset_id,
        )
        return SnowTicket(
            sys_id=result.get("sys_id", ""),
            number=result.get("number", ""),
            state=result.get("state", ""),
            short_description=result.get("short_description", ""),
            created_on=result.get("sys_created_on", ""),
        )

    async def create_change_request(
        self,
        asset_id: UUID | str,
        description: str,
        short_desc: str | None = None,
        change_type: str = "normal",
    ) -> SnowTicket:
        """
        Open a ServiceNow Change Request.

        Args:
            asset_id:    AssetSphere asset UUID.
            description: Full change description.
            short_desc:  Summary (auto-generated if not provided).
            change_type: "normal" | "standard" | "emergency"

        Returns:
            SnowTicket representing the created change.
        """
        payload: dict[str, Any] = {
            "short_description": short_desc or f"Asset change request — {asset_id}",
            "description": description,
            "type": change_type,
            "work_notes": f"AssetSphere asset_id: {asset_id}",
            "requested_by": settings.SERVICENOW_USERNAME,
        }
        result = await self._table_post("change_request", payload)
        logger.info(
            "ServiceNow: created change request %s for asset %s",
            result.get("number"),
            asset_id,
        )
        return SnowTicket(
            sys_id=result.get("sys_id", ""),
            number=result.get("number", ""),
            state=result.get("state", ""),
            short_description=result.get("short_description", ""),
            created_on=result.get("sys_created_on", ""),
        )

    async def sync_ci_record(self, asset: dict[str, Any]) -> dict[str, Any]:
        """
        Create or update a CMDB CI record from an AssetSphere asset dict.

        The asset dict should contain the fields you want to push to CMDB.
        A lookup is performed first on `serial_number`; if found the CI is
        updated, otherwise a new one is created.

        Args:
            asset: Dict with at minimum {"name", "serial_number", "vendor",
                   "version", "status"}.

        Returns:
            The ServiceNow result dict.
        """
        table = "cmdb_ci_software_instance"
        serial = asset.get("serial_number", "")

        # Try to find existing CI by serial number
        existing: list[dict[str, Any]] = []
        if serial:
            existing = await self._table_get(
                table,
                params={
                    "sysparm_query": f"serial_number={serial}",
                    "sysparm_fields": "sys_id,name",
                    "sysparm_limit": 1,
                },
            )

        ci_payload: dict[str, Any] = {
            "name": asset.get("name", ""),
            "serial_number": serial,
            "manufacturer": asset.get("vendor", ""),
            "version": asset.get("version", ""),
            "install_status": _map_status_to_snow(asset.get("status", "active")),
            "u_assetsphere_id": str(asset.get("id", "")),
        }

        if existing:
            sys_id = existing[0]["sys_id"]
            result = await self._table_put(table, sys_id, ci_payload)
            logger.info("ServiceNow: updated CI %s", sys_id)
        else:
            result = await self._table_post(table, ci_payload)
            logger.info("ServiceNow: created CI %s", result.get("sys_id"))

        return result

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "ServiceNowClient":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()


def _map_status_to_snow(status: str) -> str:
    """Map AssetSphere asset status to ServiceNow install_status value."""
    mapping = {
        "active": "1",
        "inactive": "6",
        "expiring": "1",
        "expired": "7",
        "retired": "7",
        "pending": "3",
    }
    return mapping.get(status, "1")


# ── Module-level singleton ────────────────────────────────────────────────────
_client: ServiceNowClient | None = None


def get_servicenow_client() -> ServiceNowClient:
    global _client
    if _client is None:
        _client = ServiceNowClient()
    return _client
