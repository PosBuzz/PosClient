from fastapi import FastAPI
from app.core.config import settings
from app.api.v1 import endpoints
from app.core.rabbitmq import rabbitmq_manager
from app.core.cache import description_cache
from app.services.service_factory import search_service
from app.rabbitmq.handlers import handle_generate_description
import logging

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

app = FastAPI(title=settings.APP_NAME)

# Include routes without the /api/v1 prefix
app.include_router(endpoints.router)

# Include routes with the /api/v1 prefix
app.include_router(endpoints.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Welcome to the AI microservice!"}


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Connect to RabbitMQ
        await rabbitmq_manager.connect()
        
        # Register message handlers
        rabbitmq_manager.register_handler("generate_description", handle_generate_description)
        
        # Initialize cache
        await description_cache.connect()
        
        # Initialize search service
        search_service.connect()
        
        # Show cache status on startup
        await description_cache.debug_cache_state()
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    await rabbitmq_manager.close()
