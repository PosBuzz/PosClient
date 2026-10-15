from dotenv import load_dotenv
import os

load_dotenv()


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "AI Service")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True") == "True"

    # JWT settings
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "655a41e13d92ebe879e8fae73a575c1e25eb8cc1e4ddf78f6a19f91cdfb78"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")

    # RabbitMQ settings. Optional and off by default: without it the backend calls
    # POST /generate-description over HTTP. Set RABBITMQ_ENABLED=True to consume the queue.
    RABBITMQ_ENABLED: bool = os.getenv("RABBITMQ_ENABLED", "False") == "True"
    RABBITMQ_URL: str = os.getenv(
        "RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"
    )

    # Cache settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    CACHE_TTL: int = int(os.getenv("CACHE_TTL", 86400))  # Default: 1 day
    # Off by default: the in-memory cache is used unless Redis is switched on
    CACHE_REDIS_ENABLED: bool = os.getenv(
        "CACHE_REDIS_ENABLED", "False") == "True"

    # Search settings - default to DuckDuckGo
    SEARCH_ENGINE: str = os.getenv("SEARCH_ENGINE", "duckduckgo")
    GOOGLE_SEARCH_API_KEY: str = os.getenv("GOOGLE_SEARCH_API_KEY", "")
    GOOGLE_SEARCH_CX: str = os.getenv("GOOGLE_SEARCH_CX", "")

    # ChromaDB settings
    CHROMA_DB_DIR: str = os.getenv("CHROMA_DB_DIR", "./data/chroma_db")
    CHROMA_TELEMETRY: bool = os.getenv("CHROMA_TELEMETRY", "False") == "True"
    CHROMA_COLLECTION_SHARDING: bool = os.getenv("CHROMA_COLLECTION_SHARDING", "True") == "True"
    
    # Performance settings
    MAX_BACKGROUND_BATCH_SIZE: int = int(os.getenv("MAX_BACKGROUND_BATCH_SIZE", "5"))
    FEEDBACK_MAX_FILES: int = int(os.getenv("FEEDBACK_MAX_FILES", "10000"))
    
    # Optimization settings
    VECTOR_STORE_CACHE_TTL: int = int(os.getenv("VECTOR_STORE_CACHE_TTL", "3600"))  # Default: 1 hour
    BACKGROUND_LEARNING_INTERVAL: int = int(os.getenv("BACKGROUND_LEARNING_INTERVAL", "43200"))  # Default: 12 hours

    # Feedback settings
    FEEDBACK_CACHE_TTL: int = int(os.getenv("FEEDBACK_CACHE_TTL", "3600"))  # Default: 1 hour
    FEEDBACK_ANALYSIS_INTERVAL: int = int(os.getenv("FEEDBACK_ANALYSIS_INTERVAL", "86400"))  # Default: 24 hours
    FEEDBACK_CLEANUP_INTERVAL: int = int(os.getenv("FEEDBACK_CLEANUP_INTERVAL", "604800"))  # Default: 7 days
    FEEDBACK_QUALITY_THRESHOLD: int = int(os.getenv("FEEDBACK_QUALITY_THRESHOLD", "4"))  # Default: 4 stars

    # History settings
    HISTORY_CLEANUP_INTERVAL: int = int(os.getenv("HISTORY_CLEANUP_INTERVAL", "604800"))  # Default: 7 days
    HISTORY_VERSIONS_TO_KEEP: int = int(os.getenv("HISTORY_VERSIONS_TO_KEEP", "3"))  # Default: keep 3 versions

    # LLM settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama3:8b-instruct-q8_0")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    LLM_NUM_GPU: int = int(os.getenv("LLM_num_gpu", "0"))
    LLM_NUM_CTX: int = int(os.getenv("LLM_NUM_CTX", "512"))
    LLM_NUM_THREAD: int = int(os.getenv("LLM_NUM_THREAD", "8"))
    LLM_REPEAT_PENALTY: float = float(os.getenv("LLM_REPEAT_PENALTY", "1.1"))

    # Vector embedding settings
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    USE_GPU: bool = os.getenv("USE_GPU", "False") == "True"


settings = Settings()
