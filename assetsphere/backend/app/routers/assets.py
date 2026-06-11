"""
Asset CRUD routes.

  GET    /api/assets               — paginated list with filters
  GET    /api/assets/{id}          — single asset detail
  POST   /api/assets               — create asset
  PUT    /api/assets/{id}          — update asset
  DELETE /api/assets/{id}          — soft-delete (retire)
  POST   /api/assets/{id}/sync     — trigger integration sync for this asset
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user, require_manager_or_admin
from app.database import get_db
from app.models.asset import Asset, AssetSource, AssetStatus, AssetTag, AssetType
from app.models.lifecycle import LifecycleEvent, LifecycleStage
from app.models.user import User
from app.schemas.asset import (
    AssetCreate,
    AssetListResponse,
    AssetRead,
    AssetUpdate,
)
from app.services.intune import get_intune_client
from app.services.nexthink import get_nexthink_client
from app.services.servicenow import get_servicenow_client

router = APIRouter(prefix="/assets", tags=["assets"])


async def _get_asset_or_404(asset_id: uuid.UUID, db: AsyncSession) -> Asset:
    result = await db.execute(
        select(Asset)
        .options(
            selectinload(Asset.tags),
            selectinload(Asset.licenses),
            selectinload(Asset.lifecycle_events),
            selectinload(Asset.assigned_user),
        )
        .where(Asset.id == asset_id, Asset.status != AssetStatus.retired)
    )
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


@router.get("", response_model=AssetListResponse, summary="List assets")
async def list_assets(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    status: Optional[AssetStatus] = Query(None),
    asset_type: Optional[AssetType] = Query(None, alias="type"),
    department: Optional[str] = Query(None),
    source: Optional[AssetSource] = Query(None),
    search: Optional[str] = Query(None),
) -> AssetListResponse:
    stmt = select(Asset).options(selectinload(Asset.tags))
    stmt = stmt.where(Asset.status != AssetStatus.retired)
    if status is not None:
        stmt = stmt.where(Asset.status == status)
    if asset_type is not None:
        stmt = stmt.where(Asset.asset_type == asset_type)
    if department is not None:
        stmt = stmt.where(Asset.department.ilike(f"%{department}%"))
    if source is not None:
        stmt = stmt.where(Asset.source == source)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Asset.name.ilike(pattern),
                Asset.vendor.ilike(pattern),
                Asset.serial_number.ilike(pattern),
            )
        )
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Asset.updated_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    assets = result.scalars().all()
    return AssetListResponse(
        items=list(assets),
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/{asset_id}", response_model=AssetRead, summary="Get asset by ID")
async def get_asset(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Asset:
    return await _get_asset_or_404(asset_id, db)


@router.post("", response_model=AssetRead, status_code=status.HTTP_201_CREATED, summary="Create asset")
async def create_asset(
    payload: AssetCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_manager_or_admin)],
) -> Asset:
    asset_data = payload.model_dump(exclude={"tag_ids"})
    asset = Asset(**asset_data)
    if payload.tag_ids:
        tag_result = await db.execute(select(AssetTag).where(AssetTag.id.in_(payload.tag_ids)))
        asset.tags = list(tag_result.scalars().all())
    db.add(asset)
    await db.flush()
    event = LifecycleEvent(
        asset_id=asset.id,
        stage=LifecycleStage.requested,
        previous_stage=None,
        changed_by=current_user.id,
        notes="Asset created",
    )
    db.add(event)
    await db.flush()
    return await _get_asset_or_404(asset.id, db)


@router.put("/{asset_id}", response_model=AssetRead, summary="Update asset")
async def update_asset(
    asset_id: uuid.UUID,
    payload: AssetUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_manager_or_admin)],
) -> Asset:
    asset = await _get_asset_or_404(asset_id, db)
    update_data = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for field, value in update_data.items():
        setattr(asset, field, value)
    if payload.tag_ids is not None:
        tag_result = await db.execute(select(AssetTag).where(AssetTag.id.in_(payload.tag_ids)))
        asset.tags = list(tag_result.scalars().all())
    asset.updated_at = datetime.now(tz=timezone.utc)
    await db.flush()
    return await _get_asset_or_404(asset_id, db)


@router.delete(
    "/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete asset (retire)",
    dependencies=[Depends(require_manager_or_admin)],
)
async def delete_asset(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    asset.status = AssetStatus.retired
    asset.updated_at = datetime.now(tz=timezone.utc)
    event = LifecycleEvent(
        asset_id=asset.id,
        stage=LifecycleStage.retired,
        previous_stage=None,
        changed_by=current_user.id,
        notes="Asset retired via API delete",
    )
    db.add(event)
    await db.flush()


@router.post("/{asset_id}/sync", summary="Trigger integration sync for asset")
async def sync_asset(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    asset = await _get_asset_or_404(asset_id, db)
    synced_fields: dict = {}
    try:
        if asset.source == AssetSource.nexthink:
            client = get_nexthink_client()
            devices = await client.get_all_devices()
            matching = [d for d in devices if d["device_name"] == asset.name or d.get("serial_number") == asset.serial_number]
            if matching:
                device = matching[0]
                asset.last_seen = datetime.fromisoformat(device["last_seen"].replace("Z", "+00:00"))
                synced_fields = {"last_seen": str(asset.last_seen)}
        elif asset.source == AssetSource.servicenow:
            client = get_servicenow_client()
            query = f"serial_number={asset.serial_number}" if asset.serial_number else f"name={asset.name}"
            records = await client.get_cmdb_records(query=query)
            if records:
                rec = records[0]
                asset.last_seen = datetime.now(tz=timezone.utc)
                synced_fields = {"serial_number": rec["serial_number"], "last_seen": str(asset.last_seen)}
        elif asset.source == AssetSource.intune:
            client = get_intune_client()
            devices = await client.get_devices()
            matching = [d for d in devices if d["serial_number"] == asset.serial_number]
            if matching:
                device = matching[0]
                asset.last_seen = datetime.fromisoformat(
                    device["last_sync_date_time"].replace("Z", "+00:00")
                )
                synced_fields = {
                    "device_name": device["device_name"],
                    "os_version": device["os_version"],
                    "last_seen": str(asset.last_seen),
                }
        else:
            return {"asset_id": str(asset_id), "message": "No integration configured for manual assets"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Integration sync failed: {exc}",
        ) from exc
    asset.updated_at = datetime.now(tz=timezone.utc)
    await db.flush()
    return {
        "asset_id": str(asset_id),
        "source": asset.source.value,
        "synced_fields": synced_fields,
        "status": "ok",
    }
