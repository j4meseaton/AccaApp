import enum, uuid
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class LifecycleStage(str, enum.Enum):
    requested="requested"; approved="approved"; procurement="procurement"; received="received"
    deployed="deployed"; review="review"; renewal="renewal"; retired="retired"

ALLOWED_TRANSITIONS: dict[LifecycleStage, list[LifecycleStage]] = {
    LifecycleStage.requested: [LifecycleStage.approved, LifecycleStage.retired],
    LifecycleStage.approved: [LifecycleStage.procurement, LifecycleStage.retired],
    LifecycleStage.procurement: [LifecycleStage.received, LifecycleStage.retired],
    LifecycleStage.received: [LifecycleStage.deployed, LifecycleStage.retired],
    LifecycleStage.deployed: [LifecycleStage.review, LifecycleStage.renewal, LifecycleStage.retired],
    LifecycleStage.review: [LifecycleStage.renewal, LifecycleStage.retired],
    LifecycleStage.renewal: [LifecycleStage.deployed, LifecycleStage.retired],
    LifecycleStage.retired: [],
}

class LifecycleEvent(Base):
    __tablename__ = "lifecycle_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True)
    stage: Mapped[LifecycleStage] = mapped_column(Enum(LifecycleStage, name="lifecyclestage"), nullable=False, index=True)
    previous_stage: Mapped[LifecycleStage | None] = mapped_column(Enum(LifecycleStage, name="lifecyclestage"), nullable=True)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    servicenow_ticket: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    asset: Mapped["Asset"] = relationship("Asset", back_populates="lifecycle_events")  # type: ignore
    changed_by_user: Mapped["User | None"] = relationship("User", back_populates="lifecycle_events_authored", foreign_keys=[changed_by])  # type: ignore
