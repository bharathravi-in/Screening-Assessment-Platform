from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://poc_user:poc_password@localhost:5432/assessments_db"

    # JWT
    jwt_secret_key: str = "change-this-to-a-random-secret-key-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173"

    # AI Providers
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    default_ai_provider: str = "openai"

    # File uploads
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10

    # Email
    email_type: str = "none"  # "local" (Gmail via env), "smtp" (DB config), "none" (disabled)
    gmail_email: str = ""
    gmail_app_password: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
