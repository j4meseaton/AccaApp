from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore")
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/assetsphere"
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    NEXTHINK_BASE_URL: str = "https://your-instance.nexthink.cloud"
    NEXTHINK_CLIENT_ID: str = ""
    NEXTHINK_CLIENT_SECRET: str = ""
    SERVICENOW_BASE_URL: str = "https://your-instance.service-now.com"
    SERVICENOW_USERNAME: str = ""
    SERVICENOW_PASSWORD: str = ""
    INTUNE_TENANT_ID: str = ""
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    @property
    def azure_jwks_uri(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}/discovery/v2.0/keys"

    @property
    def azure_issuer(self) -> str:
        return f"https://login.microsoftonline.com/{self.AZURE_TENANT_ID}/v2.0"

@lru_cache
def get_settings() -> Settings:
    return Settings()
