import json
import logging
from typing import Callable
import aio_pika
from app.core.config import settings
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

class RabbitMQManager:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.url = settings.RABBITMQ_URL
        self.jwt_secret = settings.JWT_SECRET
        self.jwt_algorithm = settings.JWT_ALGORITHM

    async def connect(self):
        try:
            logger.info("Connecting to RabbitMQ...")
            self.connection = await aio_pika.connect_robust(self.url)
            self.channel = await self.connection.channel()
            
            # Declare exchanges
            await self.channel.declare_exchange("ai_tasks", aio_pika.ExchangeType.DIRECT, durable=True)
            
            # Declare queues
            await self.channel.declare_queue("generate_description_queue", durable=True)
            await self.channel.declare_queue("description_responses", durable=True)
            
            # Bind queues to exchange
            queue = await self.channel.declare_queue("generate_description_queue", durable=True)
            await queue.bind("ai_tasks", routing_key="generate_description")
            
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

    async def consume_messages(self, queue_name, callback: Callable):
        if not self.channel:
            await self.connect()
        if not self.channel:
            logger.error("RabbitMQ channel is not initialized.")
            raise RuntimeError("RabbitMQ channel is not initialized.")

        queue = await self.channel.declare_queue(queue_name, durable=True)
        
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    try:
                        body = message.body.decode()
                        data = json.loads(body)
                        
                        # Verify JWT if present
                        if "jwt" in data:
                            try:
                                payload = jwt.decode(
                                    data["jwt"],
                                    self.jwt_secret,
                                    algorithms=[self.jwt_algorithm]
                                )
                                # Add user info from JWT to the data for the callback
                                data["user"] = payload
                            except JWTError:
                                logger.error("Invalid JWT in message")
                                # Skip processing this message
                                continue
                        
                        # Process the message
                        await callback(data)
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")

rabbitmq_manager = RabbitMQManager()