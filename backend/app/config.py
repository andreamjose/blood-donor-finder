from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days

    # Email (optional: leave blank in development and the reset link prints in the terminal)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = ""
    frontend_url: str = "http://localhost:5173"
    reset_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()