import enum, uuid
from datetime import datetime, date
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Table, Column, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class AssetType(str, enum.Enum):
    software="software"; hardware="hardware"; virtual="virtual"; cloud="cloud"; saas="saas"

class AssetStatus(str, enum.Enum):
    active="active"; inactive="inactive"; expiring="expiring"; expired="expired"; retired="retired"; pending="pending"

class AssetSource(str, enum.Enum):
    manual="manual"; nexthink="nexthink"; servicenow="servicenow"; intune="intune"; discovery="discovery"

asset_tag_association = Table("asset_tag_associations", Base.metadata,
    Column("asset_id", UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("asset_tags.id", ondelete="CASCADE"), primary_key=True))

class AssetTag(Base):
    __tablename__ = "asset_tags"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    assets: Mapped[list["Asset"]] = relationship("Asset", secondary=asset_tag_association, back_populates="tags")

class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType, name="assettype"), nullable=False, index=True)
    vendor: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus, name="assetstatus"), nullable=False, default=AssetStatus.active, server_default=AssetStatus.active.value, index=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    support_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cost: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="GBP", server_default="GBP")
    license_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contract_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[AssetSource] = mapped_column(Enum(AssetSource, name="assetsource"), nullable=False, default=AssetSource.manual, server_default=AssetSource.manual.value, index=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    assigned_user: Mapped["User | None"] = relationship("User", back_populates="assets", foreign_keys=[assigned_to_user_id])  # type: ignore
    tags: Mapped[list["AssetTag"]] = relationship("AssetTag", secondary=asset_tag_association, back_populates="assets")
    licenses: Mapped[list["License"]] = relationship("License", back_populates="asset", cascade="all, delete-orphan")  # type: ignore
    lifecycle_events: Mapped[list["LifecycleEvent"]] = relationship("LifecycleEvent", back_populates="asset", cascade="all, delete-orphan", order_by="LifecycleEvent.created_at")  # type: ignore
