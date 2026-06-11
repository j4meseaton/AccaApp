"""
License management routes.

  GET  /api/licenses                  — list all licenses with compliance
  GET  /api/licenses/expiring         — expiring within N days
  GET  /api/licenses/compliance-summary — aggregated stats
  POST /api/licenses                  — create license record
  PUT  /api/licenses/{id}             — update license
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, List, Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user, require_manager_or_admin
from app.config import get_settings
from app.database import get_db
from app.models.asset import Asset
from app.models.license import ComplianceStatus, License
from app.models.user import User
from app.schemas.license import (
    ComplianceSummary,
    ExpiringLicenseRead,
    LicenseCreate,
    LicenseRead,
    LicenseUpdate,
)

router = APIRouter(prefix="/licenses", tags=["licenses"])
settings = get_settings()


def _get_fernet() -> Fernet:
    key = settings.SECRET_KEY.encode()
    import base64
    padded = base64.urlsafe_b64encode(key[:32].ljust(32, b"\x00"))
    return Fernet(padded)


def _encrypt_key(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def _decrypt_key(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        return "[decryption error]"


async def _get_license_or_404(license_id: uuid.UUID, db: AsyncSession) -> License:
    result = await db.execute(
        select(License).options(selectinload(License.assignments)).where(License.id == license_id)
    )
    lic = result.scalar_one_or_none()
    if lic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="License not found")
    return lic


def _auto_update_compliance(lic: License) -> None:
    lic.compliance_status = lic.recalculate_compliance()


@router.get("", response_model=List[LicenseRead], summary="List all licenses")
async def list_licenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    compliance_status: Optional[ComplianceStatus] = Query(None),
    asset_id: Optional[uuid.UUID] = Query(None),
) -> list[License]:
    stmt = select(License).options(selectinload(License.assignments))
    if compliance_status is not None:
        stmt = stmt.where(License.compliance_status == compliance_status)
    if asset_id is not None:
        stmt = stmt.where(License.asset_id == asset_id)
    stmt = stmt.order_by(License.updated_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/expiring", response_model=List[ExpiringLicenseRead], summary="Get expiring licenses")
async def list_expiring_licenses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: int = Query(30, ge=1, le=365),
) -> list[dict]:
    cutoff = date.today() + timedelta(days=days)
    stmt = (
        select(License, Asset)
        .join(Asset, License.asset_id == Asset.id)
        .where(Asset.expiry_date <= cutoff, Asset.expiry_date >= date.today())
        .options(selectinload(License.assignments))
        .order_by(Asset.expiry_date.asc())
    )
    rows = (await db.execute(stmt)).all()
    results = []
    today = date.today()
    for lic, asset in rows:
        days_left = (asset.expiry_date - today).days if asset.expiry_date else None
        item = {
            **LicenseRead.model_validate(lic).model_dump(),
            "asset_name": asset.name,
            "days_until_expiry": days_left,
        }
        results.append(item)
    return results


@router.get("/compliance-summary", response_model=ComplianceSummary, summary="Aggregated compliance statistics")
async def compliance_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComplianceSummary:
    async def _count(where_clause) -> int:
        r = await db.execute(select(func.count(License.id)).where(where_clause))
        return r.scalar_one()
    total = await _count(License.id.is_not(None))
    compliant = await _count(License.compliance_status == ComplianceStatus.compliant)
    at_risk = await _count(License.compliance_status == ComplianceStatus.at_risk)
    over_allocated = await _count(License.compliance_status == ComplianceStatus.over_allocated)
    expired = await _count(License.compliance_status == ComplianceStatus.expired)
    seat_stmt = select(
        func.coalesce(func.sum(License.seats_purchased), 0).label("purchased"),
        func.coalesce(func.sum(License.seats_in_use), 0).label("in_use"),
    )
    seat_row = (await db.execute(seat_stmt)).one()
    purchased: int = seat_row.purchased
    in_use: int = seat_row.in_use
    utilisation = round(in_use / purchased * 100, 2) if purchased else 0.0
    return ComplianceSummary(
        total_licenses=total,
        compliant=compliant,
        at_risk=at_risk,
        over_allocated=over_allocated,
        expired=expired,
        total_seats_purchased=purchased,
        total_seats_in_use=in_use,
        overall_utilisation_pct=utilisation,
    )


@router.post("", response_model=LicenseRead, status_code=status.HTTP_201_CREATED, summary="Create license record")
async def create_license(
    payload: LicenseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_manager_or_admin)],
) -> License:
    asset_result = await db.execute(select(Asset).where(Asset.id == payload.asset_id))
    if asset_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Asset {payload.asset_id} not found")
    lic_data = payload.model_dump(exclude={"license_key"})
    lic = License(**lic_data)
    if payload.license_key:
        lic.license_key_encrypted = _encrypt_key(payload.license_key)
    _auto_update_compliance(lic)
    db.add(lic)
    await db.flush()
    return await _get_license_or_404(lic.id, db)


@router.put("/{license_id}", response_model=LicenseRead, summary="Update license")
async def update_license(
    license_id: uuid.UUID,
    payload: LicenseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_manager_or_admin)],
) -> License:
    lic = await _get_license_or_404(license_id, db)
    update_data = payload.model_dump(exclude_unset=True, exclude={"license_key"})
    for field, value in update_data.items():
        setattr(lic, field, value)
    if payload.license_key is not None:
        lic.license_key_encrypted = _encrypt_key(payload.license_key)
    _auto_update_compliance(lic)
    lic.updated_at = datetime.now(tz=timezone.utc)
    await db.flush()
    return lic
