from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PACKAGED_MODEL = Path(__file__).resolve().parents[2] / "model"
WINDOWS_MODEL = "C:/Users/Admin/Desktop/demo/Vietnamese-Sign-Language/Siformer"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parents[1] / ".env", extra="ignore"
    )
    siformer_model_root: Path = (PACKAGED_MODEL if PACKAGED_MODEL.is_dir() else Path(WINDOWS_MODEL))
    ai_token_secret: SecretStr = SecretStr("")
    ai_allowed_origins: list[str] = []
    ai_request_timeout: int = Field(default=45, ge=1, le=120)
    ai_upload_timeout: int = Field(default=15, ge=1, le=30)
    # CPU is explicitly authorized for the Windows classroom demo.
    ai_device: Literal["cpu"] = "cpu"
    mp_python: str = ""
    mp_math_library: str = ""

    @field_validator("mp_math_library")
    @classmethod
    def pinned_native_library(cls, value):
        expected = PACKAGED_MODEL.parent / "native/libwindows_float.so"
        if value and Path(value).resolve() != expected.resolve():
            raise ValueError("Only the packaged native compatibility library is allowed")
        return value
    ai_state_backend: Literal["memory", "redis"] = "memory"
    ai_redis_url: SecretStr = SecretStr("")
    ai_state_namespace: str = "signhearing:ai:v1:"
    ai_blob_origin: str = ""
    blob_read_write_token: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def vercel_deployment(self):
        import os
        from urllib.parse import urlsplit
        if os.environ.get("VERCEL") == "1":
            if self.ai_state_backend != "redis" or urlsplit(self.ai_redis_url.get_secret_value()).scheme != "rediss":
                raise ValueError("Vercel requires TLS shared replay state")
            origins=list(self.ai_allowed_origins)
            for key in ("VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
                host=os.environ.get(key, "")
                if host:
                    origin="https://"+host
                    self.exact_origins([origin])
                    if origin not in origins: origins.append(origin)
            self.ai_allowed_origins=origins
        return self

    @field_validator("ai_blob_origin")
    @classmethod
    def private_blob_origin(cls, value):
        import re
        if value and not re.fullmatch(r"https://[a-z0-9]+\.private\.blob\.vercel-storage\.com", value):
            raise ValueError("A fixed private Vercel Blob origin is required")
        return value


    @field_validator("siformer_model_root")
    @classmethod
    def authorized_model_only(cls, value):
        expected = Path(WINDOWS_MODEL)
        if value.resolve() not in (expected.resolve(), PACKAGED_MODEL.resolve()):
            raise ValueError("Only the authorized SiFormer directory is allowed")
        return value

    @field_validator("ai_allowed_origins")
    @classmethod
    def exact_origins(cls, values):
        from urllib.parse import urlsplit

        for value in values:
            p = urlsplit(value)
            local = p.scheme == "http" and p.hostname in ("localhost", "127.0.0.1")
            if (
                not (p.scheme == "https" or local)
                or not p.hostname
                or p.path
                or p.username
                or p.password
                or p.query
                or p.fragment
                or "*" in value
            ):
                raise ValueError(
                    "Use exact HTTPS origins (HTTP allowed only on loopback)"
                )
        return values
