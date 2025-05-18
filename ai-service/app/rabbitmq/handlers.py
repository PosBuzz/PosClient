import logging
from jose import jwt, JWTError
from app.core.config import settings
from app.llm.generate import generate_description

logger = logging.getLogger(__name__)

async def handle_generate_description(data, publish_callback=None):
    """
    Handle generate description request from RabbitMQ

    Args:
        data: The message data
        publish_callback: A callback function to publish response messages
    """
    try:
        # Extract request data
        product = data.get('product')
        request_id = data.get('requestId')
        jwt_token = data.get('jwt')

        logger.info(f"Processing description request: {request_id}")

        if not product or not request_id:
            logger.error("Missing required fields in message")
            return

        # Validate JWT if present
        if jwt_token:
            try:
                # Try to decode the token
                jwt_token = str(jwt_token).strip()
                payload = jwt.decode(
                    jwt_token,
                    settings.JWT_SECRET,
                    algorithms=[settings.JWT_ALGORITHM],
                    options={"verify_sub": False}
                )
                
                logger.info(f"JWT validated for user: {payload.get('email', 'unknown')}")
            except JWTError as e:
                logger.error(f"Invalid JWT in message: {str(e)}")
                # Continue processing in this case for resilience

        # Generate description - ADD AWAIT HERE
        description = await generate_description(product)

        # Send back the result using the callback if provided
        if publish_callback:
            await publish_callback(
                exchange_name='ai_tasks',
                routing_key='description_responses',
                message={
                    'requestId': request_id,
                    'description': description
                }
            )
            logger.info(f"Response sent for request: {request_id}")
        else:
            logger.warning("No publish callback provided, cannot send response")
            
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        # If there's an error, try to send an error response
        if publish_callback and request_id:
            try:
                await publish_callback(
                    exchange_name='ai_tasks',
                    routing_key='description_responses',
                    message={
                        'requestId': request_id,
                        'error': str(e)
                    }
                )
                logger.info(f"Error response sent for request: {request_id}")
            except Exception as publish_error:
                logger.error(f"Failed to send error response: {str(publish_error)}")
