"""
Reporting routes.

  GET /api/reports/asset-summary      — counts by type, status, source
  GET /api/reports/expiry-forecast    — assets expiring by month (next 12m)
  GET /api/reports/department-spend   — cost breakdown by department
  GET /api/reports/license-utilisation — per-asset licence utilisation
  GET /api/reports/compliance         — compliance health across all assets
"""

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.asset import Asset, AssetStatus
from app.models.license import ComplianceStatus, License
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/asset-summary", summary="Asset portfolio summary by type/status/source")
async def asset_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    async def _count_by(column) -> list[dict]:
        stmt = select(column, func.count(Asset.id)).group_by(column)
        rows = (await db.execute(stmt)).all()
        return [{"label": row[0].value if hasattr(row[0], "value") else row[0], "count": row[1]} for row in rows]
    total_result = await db.execute(select(func.count(Asset.id)))
    total: int = total_result.scalar_one()
    by_type = await _count_by(Asset.asset_type)
    by_status = await _count_by(Asset.status)
    by_source = await _count_by(Asset.source)
    return {
        "total_assets": total,
        "by_type": by_type,
        "by_status": by_status,
        "by_source": by_source,
        "generated_at": date.today().isoformat(),
    }


@router.get("/expiry-forecast", summary="Asset expiry forecast for the next 12 months")
async def expiry_forecast(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    today = date.today()
    cutoff = today + timedelta(days=365)
    stmt = (
        select(
            extract("year", Asset.expiry_date).label("year"),
            extract("month", Asset.expiry_date).label("month"),
            func.count(Asset.id).label("count"),
        )
        .where(Asset.expiry_date >= today, Asset.expiry_date <= cutoff, Asset.status != AssetStatus.retired)
        .group_by("year", "month")
        .order_by("year", "month")
    )
    rows = (await db.execute(stmt)).all()
    forecast = [{"month": f"{int(row.year):04d}-{int(row.month):02d}", "count": row.count} for row in rows]
    return {"forecast": forecast, "window_days": 365, "from": today.isoformat(), "to": cutoff.isoformat()}


@router.get("/department-spend", summary="Cost breakdown by department")
async def department_spend(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    stmt = (
        select(
            Asset.department,
            func.count(Asset.id).label("asset_count"),
            func.coalesce(func.sum(Asset.cost), 0).label("total_cost"),
            Asset.currency,
        )
        .where(Asset.status != AssetStatus.retired, Asset.department.is_not(None))
        .group_by(Asset.department, Asset.currency)
        .order_by(func.sum(Asset.cost).desc())
    )
    rows = (await db.execute(stmt)).all()
    return {
        "departments": [
            {"department": row.department, "asset_count": row.asset_count, "total_cost": float(row.total_cost), "currency": row.currency}
            for row in rows
        ]
    }


@router.get("/license-utilisation", summary="Per-asset license utilisation report")
async def license_utilisation(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    stmt = (
        select(Asset.id, Asset.name, Asset.vendor, License.seats_purchased, License.seats_in_use, License.compliance_status)
        .join(License, Asset.id == License.asset_id)
        .where(Asset.status != AssetStatus.retired)
        .order_by(Asset.name)
    )
    rows = (await db.execute(stmt)).all()
    items = []
    for row in rows:
        purchased = row.seats_purchased or 0
        in_use = row.seats_in_use or 0
        pct = round(in_use / purchased * 100, 1) if purchased else 0.0
        items.append({
            "asset_id": str(row.id),
            "asset_name": row.name,
            "vendor": row.vendor,
            "seats_purchased": purchased,
            "seats_in_use": in_use,
            "seats_available": max(0, purchased - in_use),
            "utilisation_pct": pct,
            "compliance_status": row.compliance_status.value,
            "flag": "over_allocated" if in_use > purchased else ("under_utilised" if pct < 50 else "ok"),
        })
    total_purchased = sum(i["seats_purchased"] for i in items)
    total_in_use = sum(i["seats_in_use"] for i in items)
    return {
        "items": items,
        "total_assets_with_licenses": len(items),
        "portfolio_seats_purchased": total_purchased,
        "portfolio_seats_in_use": total_in_use,
        "portfolio_utilisation_pct": round(total_in_use / total_purchased * 100, 1) if total_purchased else 0.0,
    }


@router.get("/compliance", summary="Compliance health report")
async def compliance_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    today = date.today()
    compliance_stmt = select(License.compliance_status, func.count(License.id)).group_by(License.compliance_status)
    compliance_rows = (await db.execute(compliance_stmt)).all()
    compliance_breakdown = {row[0].value: row[1] for row in compliance_rows}
    expiring_30 = (await db.execute(
        select(func.count(Asset.id)).where(
            Asset.expiry_date >= today, Asset.expiry_date <= today + timedelta(days=30), Asset.status != AssetStatus.retired
        )
    )).scalar_one()
    expiring_90 = (await db.execute(
        select(func.count(Asset.id)).where(
            Asset.expiry_date >= today, Asset.expiry_date <= today + timedelta(days=90), Asset.status != AssetStatus.retired
        )
    )).scalar_one()
    already_expired = (await db.execute(
        select(func.count(Asset.id)).where(Asset.expiry_date < today, Asset.status == AssetStatus.expired)
    )).scalar_one()
    return {
        "license_compliance": {k: compliance_breakdown.get(k, 0) for k in ["compliant", "at_risk", "over_allocated", "expired"]},
        "expiry": {"expiring_in_30_days": expiring_30, "expiring_in_90_days": expiring_90, "already_expired": already_expired},
        "generated_at": today.isoformat(),
    }
