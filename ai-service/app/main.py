from fastapi import FastAPI
from app.core.config import settings
from app.api.v1 import endpoints
from app.core.rabbitmq import rabbitmq_manager
from app.rabbitmq.handlers import handle_generate_description
import asyncio
import logging

logger = logging.getLogger(__name__)
# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = FastAPI(title=settings.APP_NAME)

# Include routes without the /api/v1 prefix since it's already added in NestJS
app.include_router(endpoints.router)

# Include routes
app.include_router(endpoints.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Welcome to the AI microservice!"}


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("=== STARTUP EVENT BEGINNING ===")
    try:
        # Connect to RabbitMQ
        logger.info("Connecting to RabbitMQ...")
        await rabbitmq_manager.connect()
        
        # Register message handlers
        logger.info("Registering message handlers...")
        rabbitmq_manager.register_handler("generate_description", handle_generate_description)
        
        # Verify handlers were registered
        logger.info(f"Registered handlers: {list(rabbitmq_manager.handlers.keys())}")
        
        # Check if the handler is callable
        if "generate_description" in rabbitmq_manager.handlers:
            logger.info(f"Handler is callable: {callable(rabbitmq_manager.handlers['generate_description'])}")
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        logger.exception("Exception details:")
        raise
    logger.info("=== STARTUP EVENT COMPLETED ===")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    await rabbitmq_manager.close()
