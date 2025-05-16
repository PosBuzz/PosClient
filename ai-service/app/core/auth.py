from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os

# Replace with the real secret/public key or retrieve from env
JWT_SECRET = os.getenv("JWT_SECRET", "your_default_secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

security = HTTPBearer()


def verify_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_sub": False}  # Don't verify subject type
        )

        # Convert the subject to string if needed for your application
        if "sub" in payload and not isinstance(payload["sub"], str):
            payload["sub    "] = str(payload["sub"])

        return payload
    except JWTError as e:
        print(f"Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invalid token: {str(e)}"
        )
