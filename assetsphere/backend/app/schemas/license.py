import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.license import ComplianceStatus


# ── License schemas ───────────────────────────────────────────────────────────

class LicenseBase(BaseModel):
    asset_id: uuid.UUID
    seats_purchased: int = Field(..., ge=0)
    seats_in_use: int = Field(0, ge=0)
    vendor_contract_url: Optional[str] = Field(None, max_length=2048)
    compliance_status: ComplianceStatus = ComplianceStatus.compliant


class LicenseCreate(LicenseBase):
    license_key: Optional[str] = Field(
        None,
        description="License key (plain text). Will be encrypted before persisting.",
    )


class LicenseUpdate(BaseModel):
    seats_purchased: Optional[int] = Field(None, ge=0)
    seats_in_use: Optional[int] = Field(None, ge=0)
    vendor_contract_url: Optional[str] = Field(None, max_length=2048)
    compliance_status: Optional[ComplianceStatus] = None
    license_key: Optional[str] = None


class LicenseRead(LicenseBase):
    id: uuid.UUID
    seats_available: int
    utilisation_pct: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Assignment schemas ────────────────────────────────────────────────────────

class LicenseAssignmentCreate(BaseModel):
    license_id: uuid.UUID
    user_id: uuid.UUID


class LicenseAssignmentRead(BaseModel):
    id: uuid.UUID
    license_id: uuid.UUID
    user_id: uuid.UUID
    assigned_at: datetime
    last_used: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Compliance / reporting schemas ────────────────────────────────────────────

class ComplianceSummary(BaseModel):
    total_licenses: int
    compliant: int
    at_risk: int
    over_allocated: int
    expired: int
    total_seats_purchased: int
    total_seats_in_use: int
    overall_utilisation_pct: float


class ExpiringLicenseRead(LicenseRead):
    asset_name: Optional[str] = None
    days_until_expiry: Optional[int] = None
