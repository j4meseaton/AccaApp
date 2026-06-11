"""
Integration management routes.

  GET  /api/integrations/status           — health of all integrations
  POST /api/integrations/nexthink/sync    — trigger NextThink sync
  POST /api/integrations/servicenow/sync  — trigger ServiceNow sync
  POST /api/integrations/intune/sync      — trigger Intune sync
  GET  /api/integrations/discovery        — list unregistered discovered assets
"""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_manager_or_admin
from app.database import get_db
from app.models.asset import Asset, AssetSource, AssetStatus, AssetType
from app.models.user import User
from app.services.intune import get_intune_client
from app.services.nexthink import get_nexthink_client
from app.services.servicenow import get_servicenow_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/integrations", tags=["integrations"])


async def _check_nexthink() -> dict[str, Any]:
    try:
        client = get_nexthink_client()
        await client._get_token()
        return {"status": "healthy", "message": "Token acquired successfully"}
    except Exception as exc:
        return {"status": "unhealthy", "message": str(exc)}


async def _check_servicenow() -> dict[str, Any]:
    from app.config import get_settings
    settings = get_settings()
    try:
        import httpx
        from base64 import b64encode
        creds = b64encode(f"{settings.SERVICENOW_USERNAME}:{settings.SERVICENOW_PASSWORD}".encode()).decode()
        async with httpx.AsyncClient(timeout=5) as http:
            resp = await http.get(
                f"{settings.SERVICENOW_BASE_URL}/api/now/table/sys_properties",
                params={"sysparm_limit": 1},
                headers={"Authorization": f"Basic {creds}", "Accept": "application/json"},
            )
        if resp.status_code in (200, 401):
            reachable = True
            msg = "Reachable" if resp.status_code == 200 else "Reachable but auth failed"
        else:
            reachable = resp.status_code < 500
            msg = f"HTTP {resp.status_code}"
        return {"status": "healthy" if reachable else "unhealthy", "message": msg}
    except Exception as exc:
        return {"status": "unhealthy", "message": str(exc)}


async def _check_intune() -> dict[str, Any]:
    try:
        client = get_intune_client()
        token = client._get_token()
        return {"status": "healthy", "message": "Graph token acquired"}
    except Exception as exc:
        return {"status": "unhealthy", "message": str(exc)}


@router.get("/status", summary="Get integration health status")
async def integration_status(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    nexthink_status = await _check_nexthink()
    snow_status = await _check_servicenow()
    intune_status = await _check_intune()
    integrations = {
        "nexthink": {**nexthink_status, "name": "NextThink"},
        "servicenow": {**snow_status, "name": "ServiceNow"},
        "intune": {**intune_status, "name": "Microsoft Intune"},
    }
    overall = "healthy" if all(v["status"] == "healthy" for v in integrations.values()) else "degraded"
    return {
        "overall": overall,
        "checked_at": datetime.now(tz=timezone.utc).isoformat(),
        "integrations": integrations,
    }


@router.post("/nexthink/sync", summary="Trigger NextThink software inventory sync", dependencies=[Depends(require_manager_or_admin)])
async def sync_nexthink(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    client = get_nexthink_client()
    try:
        inventory = await client.get_software_inventory()
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    created = 0
    updated = 0
    now = datetime.now(tz=timezone.utc)
    for item in inventory:
        result = await db.execute(
            select(Asset).where(
                Asset.name == item["name"],
                Asset.vendor == item["vendor"],
                Asset.source == AssetSource.nexthink,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.last_seen = now
            existing.version = item["version"]
            existing.updated_at = now
            updated += 1
        else:
            last_seen_dt: datetime | None = None
            if item.get("last_seen"):
                try:
                    last_seen_dt = datetime.fromisoformat(item["last_seen"].replace("Z", "+00:00"))
                except ValueError:
                    last_seen_dt = now
            new_asset = Asset(
                name=item["name"],
                vendor=item["vendor"],
                version=item["version"],
                asset_type=AssetType.software,
                source=AssetSource.nexthink,
                status=AssetStatus.active,
                last_seen=last_seen_dt or now,
            )
            db.add(new_asset)
            created += 1
    await db.flush()
    return {"status": "ok", "synced_at": now.isoformat(), "total_items": len(inventory), "created": created, "updated": updated}


@router.post("/servicenow/sync", summary="Trigger ServiceNow CMDB sync", dependencies=[Depends(require_manager_or_admin)])
async def sync_servicenow(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    table: str = "cmdb_ci_computer",
    query: str | None = None,
) -> dict:
    client = get_servicenow_client()
    try:
        records = await client.get_cmdb_records(table=table, query=query)
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    created = 0
    updated = 0
    now = datetime.now(tz=timezone.utc)
    for rec in records:
        serial = rec.get("serial_number", "").strip()
        if not serial:
            continue
        result = await db.execute(
            select(Asset).where(Asset.serial_number == serial, Asset.source == AssetSource.servicenow)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.name = rec["name"] or existing.name
            existing.vendor = rec["manufacturer"] or existing.vendor
            existing.last_seen = now
            existing.updated_at = now
            updated += 1
        else:
            new_asset = Asset(
                name=rec["name"] or serial,
                vendor=rec["manufacturer"],
                serial_number=serial,
                asset_type=AssetType.hardware,
                source=AssetSource.servicenow,
                status=AssetStatus.active,
                last_seen=now,
            )
            db.add(new_asset)
            created += 1
    await db.flush()
    return {"status": "ok", "synced_at": now.isoformat(), "total_records": len(records), "created": created, "updated": updated}


@router.post("/intune/sync", summary="Trigger Microsoft Intune device sync", dependencies=[Depends(require_manager_or_admin)])
async def sync_intune(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    client = get_intune_client()
    now = datetime.now(tz=timezone.utc)
    devices_created = devices_updated = apps_created = apps_updated = 0
    try:
        devices = await client.get_devices()
        for device in devices:
            serial = device.get("serial_number", "").strip()
            if not serial:
                continue
            result = await db.execute(
                select(Asset).where(Asset.serial_number == serial, Asset.source == AssetSource.intune)
            )
            existing = result.scalar_one_or_none()
            last_sync = device.get("last_sync_date_time", "")
            last_seen_dt: datetime | None = None
            if last_sync:
                try:
                    last_seen_dt = datetime.fromisoformat(last_sync.replace("Z", "+00:00"))
                except ValueError:
                    last_seen_dt = now
            if existing:
                existing.name = device["device_name"] or existing.name
                existing.version = device["os_version"] or existing.version
                existing.last_seen = last_seen_dt or now
                existing.updated_at = now
                devices_updated += 1
            else:
                new_asset = Asset(
                    name=device["device_name"] or serial,
                    vendor=device["manufacturer"],
                    version=device["os_version"],
                    serial_number=serial,
                    asset_type=AssetType.hardware,
                    source=AssetSource.intune,
                    status=AssetStatus.active,
                    last_seen=last_seen_dt or now,
                )
                db.add(new_asset)
                devices_created += 1
    except Exception as exc:
        logger.warning("Intune device sync failed: %s", exc)
    try:
        detected_apps = await client.get_detected_apps()
        for app in detected_apps:
            result = await db.execute(
                select(Asset).where(
                    Asset.name == app["display_name"],
                    Asset.version == app["version"],
                    Asset.source == AssetSource.intune,
                    Asset.asset_type == AssetType.software,
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.last_seen = now
                existing.updated_at = now
                apps_updated += 1
            else:
                new_asset = Asset(
                    name=app["display_name"],
                    version=app["version"],
                    asset_type=AssetType.software,
                    source=AssetSource.intune,
                    status=AssetStatus.active,
                    last_seen=now,
                )
                db.add(new_asset)
                apps_created += 1
    except Exception as exc:
        logger.warning("Intune app sync failed: %s", exc)
    await db.flush()
    return {
        "status": "ok",
        "synced_at": now.isoformat(),
        "devices": {"created": devices_created, "updated": devices_updated},
        "apps": {"created": apps_created, "updated": apps_updated},
    }


@router.get("/discovery", summary="List unregistered discovered assets")
async def list_discovered_assets(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = 100,
) -> dict:
    result = await db.execute(
        select(Asset)
        .where(Asset.source == AssetSource.discovery, Asset.status == AssetStatus.pending)
        .order_by(Asset.last_seen.desc())
        .limit(limit)
    )
    assets = result.scalars().all()
    return {
        "items": [
            {
                "id": str(a.id),
                "name": a.name,
                "asset_type": a.asset_type.value,
                "vendor": a.vendor,
                "version": a.version,
                "serial_number": a.serial_number,
                "last_seen": a.last_seen.isoformat() if a.last_seen else None,
                "source": a.source.value,
            }
            for a in assets
        ],
        "total": len(assets),
    }
