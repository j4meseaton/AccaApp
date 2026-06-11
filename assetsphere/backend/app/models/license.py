import enum, uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ComplianceStatus(str, enum.Enum):
    compliant="compliant"; at_risk="at_risk"; over_allocated="over_allocated"; expired="expired"

class License(Base):
    __tablename__ = "licenses"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    seats_purchased: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    seats_in_use: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    license_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    vendor_contract_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    compliance_status: Mapped[ComplianceStatus] = mapped_column(Enum(ComplianceStatus, name="compliancestatus"), nullable=False, default=ComplianceStatus.compliant, server_default=ComplianceStatus.compliant.value, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    asset: Mapped["Asset"] = relationship("Asset", back_populates="licenses")  # type: ignore
    assignments: Mapped[list["LicenseAssignment"]] = relationship("LicenseAssignment", back_populates="license", cascade="all, delete-orphan")

    @property
    def seats_available(self) -> int:
        return max(0, self.seats_purchased - self.seats_in_use)

    @property
    def utilisation_pct(self) -> float:
        if self.seats_purchased == 0: return 0.0
        return round(self.seats_in_use / self.seats_purchased * 100, 2)

    def recalculate_compliance(self) -> ComplianceStatus:
        if self.seats_purchased == 0: return ComplianceStatus.expired
        ratio = self.seats_in_use / self.seats_purchased
        if ratio > 1.0: return ComplianceStatus.over_allocated
        if ratio >= 0.9: return ComplianceStatus.at_risk
        return ComplianceStatus.compliant

class LicenseAssignment(Base):
    __tablename__ = "license_assignments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    license_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licenses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    license: Mapped["License"] = relationship("License", back_populates="assignments")
    user: Mapped["User"] = relationship("User", back_populates="license_assignments")  # type: ignore
