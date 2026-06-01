from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    FRONTEND_URL: str = "http://localhost:3000"
    # Comma-separated list of allowed CORS origins
    ALLOWED_ORIGINS: str = "http://localhost:5173"

settings = Settings()