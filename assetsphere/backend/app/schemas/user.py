import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(..., max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    role: UserRole = UserRole.viewer


class UserCreate(UserBase):
    azure_oid: str = Field(..., max_length=64)


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    role: Optional[UserRole] = None


class UserRead(UserBase):
    id: uuid.UUID
    azure_oid: str
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserSummary(BaseModel):
    """Lightweight user representation for embedding in other schemas."""
    id: uuid.UUID
    email: EmailStr
    display_name: str

    model_config = {"from_attributes": True}
