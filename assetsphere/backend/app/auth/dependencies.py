import logging
from datetime import datetime, timezone
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.azure_ad import extract_user_claims, validate_token
from app.database import get_db
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)
_bearer_scheme = HTTPBearer(auto_error=True)

async def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)], db: Annotated[AsyncSession, Depends(get_db)]) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = await validate_token(credentials.credentials)
    except JWTError as e:
        raise exc from e
    user_info = extract_user_claims(claims)
    if not user_info["oid"]:
        raise exc
    result = await db.execute(select(User).where(User.azure_oid == user_info["oid"]))
    user: User | None = result.scalar_one_or_none()
    now = datetime.now(tz=timezone.utc)
    if user is None:
        user = User(azure_oid=user_info["oid"], email=user_info["email"], display_name=user_info["name"], role=_infer_role(user_info), last_login=now)
        db.add(user)
    else:
        user.email = user_info["email"]
        user.display_name = user_info["name"]
        user.last_login = now
    await db.flush()
    return user

def _infer_role(user_info: dict) -> UserRole:
    roles = user_info.get("roles", [])
    if "AssetSphere.Admin" in roles: return UserRole.admin
    if "AssetSphere.Manager" in roles: return UserRole.manager
    if "AssetSphere.Requestor" in roles: return UserRole.requestor
    return UserRole.viewer

def require_role(*allowed_roles: UserRole):
    async def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires one of: {[r.value for r in allowed_roles]}")
        return current_user
    return _check

require_admin = require_role(UserRole.admin)
require_manager_or_admin = require_role(UserRole.admin, UserRole.manager)
