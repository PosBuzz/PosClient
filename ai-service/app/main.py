from fastapi import FastAPI
from app.core.config import settings
from app.api.v1 import endpoints
from app.core.rabbitmq import rabbitmq_manager
from app.rabbitmq.handlers import handle_generate_description
import asyncio
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title=settings.APP_NAME)

# Include routes without the /api/v1 prefix since it's already added in NestJS
app.include_router(endpoints.router)

@app.get("/")
def root():
    return {"message": "Welcome to the AI microservice!"}

@app.on_event("startup")
async def startup_event():
    # Connect to RabbitMQ
    await rabbitmq_manager.connect()
    
    # Start consuming messages
    asyncio.create_task(
        rabbitmq_manager.consume_messages(
            "generate_description_queue",
            handle_generate_description
        )
    )
    logger.info("RabbitMQ consumers started")

@app.on_event("shutdown")
async def shutdown_event():
    # Close RabbitMQ connection
    await rabbitmq_manager.close()
