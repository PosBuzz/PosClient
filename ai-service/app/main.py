from fastapi import FastAPI
from app.core.config import settings
from app.api.v1 import endpoints
from app.core.rabbitmq import rabbitmq_manager
from app.core.cache import description_cache
from app.core.vector_store import vector_store
from app.core.feedback import feedback_manager
from app.core.history import history_manager
from app.core.background_learning import background_learner
from app.services.service_factory import search_service
from app.rabbitmq.handlers import handle_generate_description
import logging
import asyncio

logger = logging.getLogger(__name__)

# Configure logging - only INFO and higher in prod
logging_level = logging.DEBUG if settings.DEBUG else logging.INFO
logging.basicConfig(
    level=logging_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logging.getLogger('aio_pika').setLevel(logging.WARNING)
logging.getLogger('aiormq').setLevel(logging.WARNING)

app = FastAPI(title=settings.APP_NAME)

# Include routes
app.include_router(endpoints.router)
app.include_router(endpoints.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Welcome to the AI microservice!"}


async def periodic_cache_cleanup():
    """Run cache cleanup at regular intervals"""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            await description_cache.cleanup()
            logger.info("Completed periodic cache cleanup")
        except Exception as e:
            logger.error(f"Error during cache cleanup: {str(e)}")
            await asyncio.sleep(300)  # Wait 5 minutes before retrying


def safe_background_task(coro):
    async def wrapper():
        while True:
            try:
                await coro()
            except Exception as e:
                logger.error(f"Background task crashed: {e}")
                await asyncio.sleep(60)
    return wrapper


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Banner with app name
        app_name = settings.APP_NAME
        logger.info("=" * 50)
        logger.info(f"Starting {app_name}")
        logger.info(f"Environment: {settings.ENVIRONMENT}")
        logger.info("=" * 50)
        
        # Connect to RabbitMQ
        await rabbitmq_manager.connect()

        # Register message handlers
        rabbitmq_manager.register_handler(
            "generate_description", handle_generate_description)

        # Initialize all services
        await description_cache.connect()
        search_service.connect()
        vector_store.connect()  
        feedback_manager.initialize()
        await history_manager.initialize()
        
        # Import here to avoid circular imports
        from app.llm.generate import generate_description
        # Pass function reference to background learner
        background_learner.initialize(generate_description_func=generate_description)

        # Log cache status
        cache_stats = await description_cache.get_cache_stats()
        logger.info("Cache configuration:")
        for key, value in cache_stats.items():
            logger.info(f"  {key}: {value}")

        # Start background tasks
        asyncio.create_task(safe_background_task(periodic_cache_cleanup)())

        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    await rabbitmq_manager.close()
