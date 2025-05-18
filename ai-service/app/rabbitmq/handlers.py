import asyncio
import logging
import json
from jose import jwt, JWTError
from app.core.config import settings
from app.llm.generate import generate_description

logger = logging.getLogger(__name__)


# Create handler without direct dependency on rabbitmq_manager
async def handle_generate_description(data, publish_callback=None):
    """
    Handle generate description request from RabbitMQ

    Args:
        data: The message data
        publish_callback: A callback function to publish response messages
    """
    try:
        logger.info(
            f"Processing description request for product: {data.get('product')}")

        # Extract request data
        product = data.get('product')
        request_id = data.get('requestId')
        jwt_token = data.get('jwt')

        logger.debug(f"Request ID: {request_id}")

        if not product or not request_id:
            logger.error("Missing required fields in message")
            return

        # Extract the JWT token
        jwt_token = data.get('jwt')

        # Log for comparison
        if jwt_token:
            import hashlib
            token_hash = hashlib.md5(jwt_token.encode()).hexdigest()

            logger.debug(
                f"RabbitMQ Received - JWT token first 20 chars: {jwt_token[:20]}...")
            logger.debug(
                f"RabbitMQ Received - JWT token length: {len(jwt_token)}")
            logger.debug(f"RabbitMQ Received - JWT token hash: {token_hash}")

            # Try decoding without verification to check structure
            try:
                import json
                unverified = jwt.decode(
                    jwt_token, key="", options={"verify_signature": False, "verify_sub": False})
                logger.debug(
                    f"JWT payload structure: {json.dumps(unverified)}")
            except Exception as decode_err:
                logger.error(f"Cannot decode token format: {str(decode_err)}")

        # Validate JWT
        if jwt_token:
            try:
                # Log the token (first few chars)
                logger.debug(f"Received JWT: {jwt_token[:10]}...")
                logger.debug(f"JWT Secret: {settings.JWT_SECRET[:5]}...")

                # Add explicit string conversion in case the JWT was converted to another type
                jwt_token = str(jwt_token).strip()

                # Try to decode the token
                payload = jwt.decode(
                    jwt_token,
                    settings.JWT_SECRET,
                    algorithms=[settings.JWT_ALGORITHM],
                    options={"verify_sub": False}  # Don't verify subject type
                )

                logger.info(
                    f"JWT validated successfully for: {payload.get('email', 'unknown')}")

                # Generate description
                description = generate_description(product)

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
                    logger.info(
                        f"Description generated and sent for request {request_id}")
                else:
                    logger.warning(
                        "No publish callback provided, cannot send response")

            except JWTError as e:
                logger.error(f"Invalid JWT in message: {str(e)}")
                logger.error(f"Token length: {len(jwt_token)}")
                logger.error(f"Secret length: {len(settings.JWT_SECRET)}")

                # More detailed error info
                if jwt_token:
                    try:
                        parts = jwt_token.split('.')
                        logger.error(
                            f"JWT has {len(parts)} parts (should be 3)")
                    except Exception:
                        logger.error("JWT is not properly formatted")

                # Generate description anyway for debugging purposes
                # In production, you might want to restrict this
                description = generate_description(product)

                # Send back the result using the callback if provided
                if publish_callback:
                    await publish_callback(
                        exchange_name='ai_tasks',
                        routing_key='description_responses',
                        message={
                            'requestId': request_id,
                            'description': description,
                            'error': 'JWT validation failed, but processing request anyway'
                        }
                    )
        else:
            logger.warning("No JWT provided in the message")
            # Generate description anyway (you may want to restrict this in production)
            description = generate_description(product)

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
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
