from dotenv import load_dotenv
import os

load_dotenv()  # Load from .env file

class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "FastAPI App")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"

settings = Settings()
