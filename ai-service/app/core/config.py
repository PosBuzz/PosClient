from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "AI Service")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"

    # JWT settings - MUST match your NestJS backend
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "655a41e13d92ebe879e8fae73a575c1e25eb8cc1e4ddf78f6a19f91cdfb78"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

    # RabbitMQ settings
    RABBITMQ_URL: str = os.getenv(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"
    )


settings = Settings()
