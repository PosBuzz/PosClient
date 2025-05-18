from dotenv import load_dotenv
import os
import logging

load_dotenv()  # Load from .env file
logger = logging.getLogger(__name__)  # Add this debug statement when loading the settings


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "FastAPI App")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"

    # JWT settings - MUST match your NestJS backend
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "655a41e13d92ebe879e8fae73a575c1e25eb8cc1e4ddf78f6a19f91cdfb78")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

    # RabbitMQ settings
    RABBITMQ_URL: str = os.getenv(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

    # Debug JWT settings during startup
    def __init__(self):
        logger.debug(f"JWT_SECRET loaded, length: {len(self.JWT_SECRET)}")
        logger.debug(f"JWT_ALGORITHM: {self.JWT_ALGORITHM}")
        logger.debug(f"JWT_SECRET first 5 chars: {self.JWT_SECRET[:5]}")


settings = Settings()
