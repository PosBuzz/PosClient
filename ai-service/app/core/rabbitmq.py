import json
import logging
from typing import Callable
import aio_pika
from app.core.config import settings

logger = logging.getLogger(__name__)

class RabbitMQManager:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.url = settings.RABBITMQ_URL
        self.jwt_secret = settings.JWT_SECRET
        self.jwt_algorithm = settings.JWT_ALGORITHM
        self.handlers = {}

    def register_handler(self, routing_key, handler):
        """Register a message handler for a routing key"""
        self.handlers[routing_key] = handler
        logger.info(f"Registered handler for routing key: {routing_key}")

    async def connect(self):
        try:
            logger.info("Connecting to RabbitMQ...")
            self.connection = await aio_pika.connect_robust(self.url)
            self.channel = await self.connection.channel()

            # Declare exchanges and queues
            await self.channel.declare_exchange("ai_tasks", aio_pika.ExchangeType.DIRECT, durable=True)
            await self.channel.declare_queue("generate_description_queue", durable=True)
            await self.channel.declare_queue("description_responses", durable=True)

            # Bind queues to exchange
            queue = await self.channel.declare_queue("generate_description_queue", durable=True)
            await queue.bind("ai_tasks", routing_key="generate_description")
            
            await queue.consume(self.process_message)
            logger.info("Successfully connected to RabbitMQ")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    async def close(self):
        if self.connection:
            await self.connection.close()
            logger.info("RabbitMQ connection closed")

    async def publish_message(self, exchange_name, routing_key, message):
        if not self.channel:
            await self.connect()
        if not self.channel:
            logger.error("RabbitMQ channel is not initialized.")
            raise RuntimeError("RabbitMQ channel is not initialized.")

        exchange = await self.channel.declare_exchange(exchange_name, aio_pika.ExchangeType.DIRECT, durable=True)
        
        message_body = json.dumps(message).encode()
        await exchange.publish(
            aio_pika.Message(
                body=message_body,
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            ),
            routing_key=routing_key
        )
        
        logger.info(f"Sent message to {routing_key}, requestId: {message.get('requestId')}")

    async def consume_messages(self, queue_name, callback: Callable):
        if not self.channel:
            await self.connect()
        if not self.channel:
            logger.error("RabbitMQ channel is not initialized.")
            raise RuntimeError("RabbitMQ channel is not initialized.")

        queue = await self.channel.declare_queue(queue_name, durable=True)
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                await self.process_message(message)

    async def process_message(self, message):
        """Process incoming RabbitMQ messages"""
        async with message.process():
            try:
                body = message.body.decode()
                
                try:
                    data = json.loads(body)
                    logger.info(f"Received message with routing key: {message.routing_key}")
                    
                    # Check for JWT and make sure it's a proper string
                    if 'jwt' in data and not isinstance(data['jwt'], str):
                        if data['jwt'] is not None:
                            data['jwt'] = str(data['jwt'])
                    
                    # Process the message with the registered handler
                    if message.routing_key in self.handlers:
                        handler = self.handlers[message.routing_key]
                        await handler(data, self.publish_message)
                    else:
                        logger.warning(f"No handler registered for routing key: {message.routing_key}")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to decode JSON message: {str(e)}")
                    
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}")

# Create the singleton instance
rabbitmq_manager = RabbitMQManager()
