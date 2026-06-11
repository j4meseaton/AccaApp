"""
Authentication routes.

  GET  /api/auth/me      — return the currently authenticated user
  POST /api/auth/login   — exchange an Azure AD token for session info
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead, summary="Return current user profile")
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Return the profile of the currently authenticated user."""
    return current_user


@router.post("/login", response_model=UserRead, summary="Validate AAD token and return user")
async def login(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Validate the supplied Azure AD access token and return the application user profile."""
    return current_user
