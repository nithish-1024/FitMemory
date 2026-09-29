import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    hindsight_api_key: str = Field(default="", validation_alias="HINDSIGHT_API_KEY")
    hindsight_api_url: str = Field(
        default="https://api.hindsight.vectorize.io",
        validation_alias="HINDSIGHT_API_URL",
    )
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_model: str = Field(
        default="openai/gpt-oss-120b",
        validation_alias="GROQ_MODEL",
    )
    user_bank_prefix: str = Field(
        default="user_",
        validation_alias="USER_BANK_PREFIX",
    )
    fashion_kb_bank_id: str = "fashion_kb"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Convenient module-level aliases
GROQ_API_KEY = settings.groq_api_key
GROQ_MODEL = settings.groq_model
USER_BANK_PREFIX = settings.user_bank_prefix
