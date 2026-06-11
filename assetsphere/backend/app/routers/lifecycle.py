"""
Lifecycle management routes.

  GET  /api/lifecycle                        — all events, filterable
  POST /api/lifecycle/{asset_id}/transition  — move asset to next stage
  GET  /api/lifecycle/{asset_id}/history     — full history for one asset
"""

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.asset import Asset, AssetStatus
from app.models.lifecycle import ALLOWED_TRANSITIONS, LifecycleEvent, LifecycleStage
from app.models.user import User
from app.services.servicenow import get_servicenow_client

router = APIRouter(prefix="/lifecycle", tags=["lifecycle"])


class TransitionRequest(BaseModel):
    stage: LifecycleStage
    notes: Optional[str] = None
    create_servicenow_ticket: bool = False


class LifecycleEventRead(BaseModel):
    id: uuid.UUID
    asset_id: uuid.UUID
    stage: LifecycleStage
    previous_stage: Optional[LifecycleStage] = None
    changed_by: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    servicenow_ticket: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}

    def model_post_init(self, __context) -> None:
        if hasattr(self, "created_at") and not isinstance(self.created_at, str):
            object.__setattr__(self, "created_at", str(self.created_at))


@router.get("", summary="List lifecycle events")
async def list_lifecycle_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    asset_id: Optional[uuid.UUID] = Query(None),
    stage: Optional[LifecycleStage] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict:
    stmt = (
        select(LifecycleEvent)
        .options(selectinload(LifecycleEvent.changed_by_user))
        .order_by(LifecycleEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if asset_id is not None:
        stmt = stmt.where(LifecycleEvent.asset_id == asset_id)
    if stage is not None:
        stmt = stmt.where(LifecycleEvent.stage == stage)
    result = await db.execute(stmt)
    events = result.scalars().all()
    return {
        "items": [
            {
                "id": str(e.id),
                "asset_id": str(e.asset_id),
                "stage": e.stage.value,
                "previous_stage": e.previous_stage.value if e.previous_stage else None,
                "changed_by": str(e.changed_by) if e.changed_by else None,
                "changed_by_name": e.changed_by_user.display_name if e.changed_by_user else None,
                "notes": e.notes,
                "servicenow_ticket": e.servicenow_ticket,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
        "count": len(events),
        "offset": offset,
        "limit": limit,
    }


@router.post("/{asset_id}/transition", summary="Transition asset to a new lifecycle stage", status_code=status.HTTP_200_OK)
async def transition_asset(
    asset_id: uuid.UUID,
    payload: TransitionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    asset_result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = asset_result.scalar_one_or_none()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    last_event_result = await db.execute(
        select(LifecycleEvent)
        .where(LifecycleEvent.asset_id == asset_id)
        .order_by(LifecycleEvent.created_at.desc())
        .limit(1)
    )
    last_event = last_event_result.scalar_one_or_none()
    current_stage: LifecycleStage | None = last_event.stage if last_event else None
    if current_stage is not None:
        allowed = ALLOWED_TRANSITIONS.get(current_stage, [])
        if payload.stage not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot transition from '{current_stage.value}' to '{payload.stage.value}'. "
                    f"Allowed transitions: {[s.value for s in allowed]}"
                ),
            )
    snow_ticket: str | None = None
    if payload.create_servicenow_ticket:
        try:
            snow_client = get_servicenow_client()
            ticket = await snow_client.create_change_request(
                asset_id=asset_id,
                description=(
                    f"Asset lifecycle transition: {current_stage} → {payload.stage.value}. "
                    f"Notes: {payload.notes or 'N/A'}"
                ),
                short_desc=f"Asset {asset.name} → {payload.stage.value}",
            )
            snow_ticket = ticket["number"]
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("ServiceNow ticket creation failed: %s", exc)
    event = LifecycleEvent(
        asset_id=asset_id,
        stage=payload.stage,
        previous_stage=current_stage,
        changed_by=current_user.id,
        notes=payload.notes,
        servicenow_ticket=snow_ticket,
    )
    db.add(event)
    if payload.stage == LifecycleStage.retired:
        asset.status = AssetStatus.retired
    elif payload.stage == LifecycleStage.deployed:
        asset.status = AssetStatus.active
    elif payload.stage in (LifecycleStage.review, LifecycleStage.renewal):
        asset.status = AssetStatus.expiring
    await db.flush()
    return {
        "asset_id": str(asset_id),
        "previous_stage": current_stage.value if current_stage else None,
        "new_stage": payload.stage.value,
        "event_id": str(event.id),
        "servicenow_ticket": snow_ticket,
    }


@router.get("/{asset_id}/history", summary="Get full lifecycle history for an asset")
async def asset_lifecycle_history(
    asset_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    asset_result = await db.execute(select(Asset).where(Asset.id == asset_id))
    if asset_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    result = await db.execute(
        select(LifecycleEvent)
        .options(selectinload(LifecycleEvent.changed_by_user))
        .where(LifecycleEvent.asset_id == asset_id)
        .order_by(LifecycleEvent.created_at.asc())
    )
    events = result.scalars().all()
    return {
        "asset_id": str(asset_id),
        "events": [
            {
                "id": str(e.id),
                "stage": e.stage.value,
                "previous_stage": e.previous_stage.value if e.previous_stage else None,
                "changed_by": str(e.changed_by) if e.changed_by else None,
                "changed_by_name": e.changed_by_user.display_name if e.changed_by_user else None,
                "notes": e.notes,
                "servicenow_ticket": e.servicenow_ticket,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
        "total_events": len(events),
        "current_stage": events[-1].stage.value if events else None,
    }
