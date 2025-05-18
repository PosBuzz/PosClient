from dotenv import load_dotenv
import os

load_dotenv()  # Load from .env file

class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "FastAPI App")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"
    
    # JWT settings - MUST match your NestJS backend
    JWT_SECRET: str = os.getenv("JWT_SECRET_KEY", "at-least-32-characters-long-secret-key")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    
    # RabbitMQ settings
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")

settings = Settings()
