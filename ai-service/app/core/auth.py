from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Use settings instead of direct env vars
JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM

security = HTTPBearer()


def verify_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        logger.info(
            f"Attempting to decode token with secret key starting with: {JWT_SECRET[:5]}...")
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_sub": False}  # Don't verify subject type
        )

        logger.info(
            f"JWT decoded successfully: {payload.get('email', 'unknown')}")
        return payload
    except JWTError as e:
        logger.error(f"Token validation failed: {str(e)}")
        # Print the received token for debugging (first few characters)
        logger.error(f"Token starts with: {token[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid token: {str(e)}"
        )
