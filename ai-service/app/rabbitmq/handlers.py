import asyncio
import logging
from jose import jwt, JWTError
from app.core.config import settings
from app.llm.generate import generate_description
from app.core.rabbitmq import rabbitmq_manager

logger = logging.getLogger(__name__)

async def handle_generate_description(data):
    """
    Handle generate description request from RabbitMQ
    """
    try:
        logger.info(f"Processing description request for product: {data.get('product')}")
        
        # Extract request data
        product = data.get('product')
        request_id = data.get('requestId')
        jwt_token = data.get('jwt')
        
        logger.debug(f"Request ID: {request_id}")
        
        if not product or not request_id:
            logger.error("Missing required fields in message")
            return
        
        # Validate JWT
        if jwt_token:
            try:
                # Log the token (first few chars)
                logger.debug(f"Received JWT: {jwt_token[:10]}...")
                logger.debug(f"JWT Secret (first few chars): {settings.JWT_SECRET[:5]}...")
                
                # Try to decode the token
                payload = jwt.decode(
                    jwt_token, 
                    settings.JWT_SECRET, 
                    algorithms=[settings.JWT_ALGORITHM]
                )
                
                logger.info(f"JWT validated successfully for: {payload.get('email', 'unknown')}")
                
                # Generate description
                description = generate_description(product)
                
                # Send back the result
                await rabbitmq_manager.publish_message(
                    exchange_name='ai_tasks',
                    routing_key='description_responses',
                    message={
                        'requestId': request_id,
                        'description': description
                    }
                )
                
                logger.info(f"Description generated and sent for request {request_id}")
                
            except JWTError as e:
                logger.error(f"Invalid JWT in message: {e}")
                # Send back an error response
                await rabbitmq_manager.publish_message(
                    exchange_name='ai_tasks',
                    routing_key='description_responses',
                    message={
                        'requestId': request_id,
                        'error': 'Authentication failed',
                        'description': 'Could not validate credentials. Please try again.'
                    }
                )
        else:
            logger.warning("No JWT provided in the message")
            # Generate description anyway (you may want to restrict this in production)
            description = generate_description(product)
            
            # Send back the result
            await rabbitmq_manager.publish_message(
                exchange_name='ai_tasks',
                routing_key='description_responses',
                message={
                    'requestId': request_id,
                    'description': description
                }
            )
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")