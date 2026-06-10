import logging
import time
from typing import Any
import httpx
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
_jwks_cache: dict[str, Any] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL_SECONDS = 3600

async def _fetch_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
        return _jwks_cache
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(settings.azure_jwks_uri)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
    _jwks_cache = {key["kid"]: key for key in data.get("keys", [])}
    _jwks_fetched_at = now
    return _jwks_cache

async def _get_signing_key(token: str) -> Any:
    headers = jwt.get_unverified_header(token)
    kid: str = headers.get("kid", "")
    if not kid:
        raise JWTError("JWT missing 'kid' header")
    keys = await _fetch_jwks()
    if kid not in keys:
        global _jwks_fetched_at
        _jwks_fetched_at = 0.0
        keys = await _fetch_jwks()
    if kid not in keys:
        raise JWTError(f"Public key not found for kid={kid!r}")
    return jwk.construct(keys[kid])

async def validate_token(token: str) -> dict[str, Any]:
    signing_key = await _get_signing_key(token)
    try:
        message, encoded_sig = token.rsplit(".", 1)
        decoded_sig = base64url_decode(encoded_sig.encode("utf-8"))
        if not signing_key.verify(message.encode("utf-8"), decoded_sig):
            raise JWTError("Token signature verification failed")
    except Exception as exc:
        raise JWTError(f"Signature verification error: {exc}") from exc
    return jwt.decode(token, signing_key, algorithms=["RS256"], audience=settings.AZURE_CLIENT_ID, issuer=settings.azure_issuer)

def extract_user_claims(claims: dict[str, Any]) -> dict[str, Any]:
    oid = claims.get("oid", "") or claims.get("sub", "")
    email = (claims.get("preferred_username") or claims.get("upn") or claims.get("email") or "").lower().strip()
    return {"oid": oid, "email": email, "name": claims.get("name", "") or email.split("@")[0], "groups": claims.get("groups", []), "roles": claims.get("roles", [])}
