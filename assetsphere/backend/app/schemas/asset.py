import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.asset import AssetSource, AssetStatus, AssetType


# ── Tag schemas ───────────────────────────────────────────────────────────────

class AssetTagRead(BaseModel):
    id: uuid.UUID
    name: str
    color: Optional[str] = None

    model_config = {"from_attributes": True}


class AssetTagCreate(BaseModel):
    name: str = Field(..., max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


# ── Asset schemas ─────────────────────────────────────────────────────────────

class AssetBase(BaseModel):
    name: str = Field(..., max_length=255)
    asset_type: AssetType
    vendor: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=255)
    assigned_to_user_id: Optional[uuid.UUID] = None
    department: Optional[str] = Field(None, max_length=255)
    status: AssetStatus = AssetStatus.active
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None
    support_end_date: Optional[date] = None
    cost: Optional[float] = Field(None, ge=0)
    currency: str = Field("USD", max_length=3)
    license_type: Optional[str] = Field(None, max_length=100)
    contract_ref: Optional[str] = Field(None, max_length=255)
    source: AssetSource = AssetSource.manual


class AssetCreate(AssetBase):
    tag_ids: Optional[List[uuid.UUID]] = Field(default_factory=list)


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    asset_type: Optional[AssetType] = None
    vendor: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=255)
    assigned_to_user_id: Optional[uuid.UUID] = None
    department: Optional[str] = Field(None, max_length=255)
    status: Optional[AssetStatus] = None
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None
    support_end_date: Optional[date] = None
    cost: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    license_type: Optional[str] = Field(None, max_length=100)
    contract_ref: Optional[str] = Field(None, max_length=255)
    tag_ids: Optional[List[uuid.UUID]] = None


class AssetRead(AssetBase):
    id: uuid.UUID
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    tags: List[AssetTagRead] = []

    model_config = {"from_attributes": True}


class AssetListRead(BaseModel):
    """Lighter representation used in paginated list responses."""
    id: uuid.UUID
    name: str
    asset_type: AssetType
    vendor: Optional[str] = None
    version: Optional[str] = None
    status: AssetStatus
    department: Optional[str] = None
    source: AssetSource
    expiry_date: Optional[date] = None
    last_seen: Optional[datetime] = None
    updated_at: datetime
    tags: List[AssetTagRead] = []

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: List[AssetListRead]
    total: int
    page: int
    page_size: int
    pages: int
