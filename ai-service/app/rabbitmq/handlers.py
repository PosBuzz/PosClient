import logging
from jose import jwt, JWTError
from app.core.config import settings
from app.llm.generate import generate_description

logger = logging.getLogger(__name__)

async def handle_generate_description(data, publish_callback=None):
    """Handle generate description request from RabbitMQ"""
    request_id = None
    try:
        # Extract request data
        product = data.get('product')
        request_id = data.get('requestId')
        jwt_token = data.get('jwt')

        if not product or not request_id:
            logger.error("Missing required fields in message")
            return

        # Validate JWT if present
        if jwt_token:
            try:
                jwt_token = str(jwt_token).strip()
                payload = jwt.decode(
                    jwt_token,
                    settings.JWT_SECRET,
                    algorithms=[settings.JWT_ALGORITHM],
                    options={"verify_sub": False}
                )
            except JWTError:
                pass  # Continue for resilience

        # Generate description
        description = await generate_description(product)

        # Send back the result
        if publish_callback:
            await publish_callback(
                exchange_name='ai_tasks',
                routing_key='description_responses',
                message={
                    'requestId': request_id,
                    'description': description
                }
            )
        else:
            logger.warning("No publish callback provided, cannot send response")
            
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        # Try to send error response
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
            except Exception:
                pass  # Already in error handler
