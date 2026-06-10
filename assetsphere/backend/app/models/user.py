import enum, uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"
    requestor = "requestor"

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    azure_oid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="userrole"), nullable=False, default=UserRole.viewer, server_default=UserRole.viewer.value)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    assets: Mapped[list["Asset"]] = relationship("Asset", back_populates="assigned_user", foreign_keys="Asset.assigned_to_user_id")  # type: ignore
    license_assignments: Mapped[list["LicenseAssignment"]] = relationship("LicenseAssignment", back_populates="user")  # type: ignore
    lifecycle_events_authored: Mapped[list["LifecycleEvent"]] = relationship("LifecycleEvent", back_populates="changed_by_user")  # type: ignore
