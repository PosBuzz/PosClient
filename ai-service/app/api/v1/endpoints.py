from fastapi import APIRouter, Depends, Response, HTTPException
from pydantic import BaseModel
import secrets
from app.llm.generate import generate_description
from app.core.auth import verify_jwt  # optional if JWT is used
from app.core.config import settings
from jose import jwt, JWTError
import logging
import hashlib
import base64
import json

logger = logging.getLogger(__name__)

router = APIRouter()


class ProductInput(BaseModel):
    product: str


class JWTDebugInput(BaseModel):
    token: str


@router.get("/csrf-token")
def get_csrf_token(response: Response):
    """Get a CSRF token to use with POST requests"""
    token = secrets.token_hex(16)
    response.set_cookie(key="csrf_token", value=token,
                        httponly=True, secure=False)
    return {"csrfToken": token}


@router.post("/generate-description")
def generate(input_data: ProductInput, user_data=Depends(verify_jwt)):
    description = generate_description(input_data.product)
    return {"description": description}


@router.post("/debug/jwt")
def debug_jwt(input_data: JWTDebugInput):
    """Debug endpoint to test JWT validation"""
    try:
        # Log details about the token and secret
        logger.debug(
            f"Received token starting with: {input_data.token[:10]}...")
        logger.debug(f"Secret key starting with: {settings.JWT_SECRET[:5]}...")
        logger.debug(f"Token length: {len(input_data.token)}")
        logger.debug(f"Secret length: {len(settings.JWT_SECRET)}")

        # Try to decode
        payload = jwt.decode(
            input_data.token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_sub": False}  # Don't verify subject type
        )

        # If successful, return the payload
        return {"status": "success", "payload": payload}
    except JWTError as e:
        # If failed, return error details
        logger.error(f"JWT validation failed: {str(e)}")
        raise HTTPException(
            status_code=400, detail=f"JWT validation failed: {str(e)}")


@router.post("/debug/token-inspect")
def inspect_token(data: dict):
    """Inspect token details without validation"""
    token = data.get("token")

    response = {
        "token_type": str(type(token)),
        "token_length": len(token) if token else 0,
        "is_string": isinstance(token, str),
        "has_whitespace": any(c.isspace() for c in token) if token and isinstance(token, str) else False,
        "first_20_chars": token[:20] if token else None,
        "token_hash": hashlib.md5(token.encode()).hexdigest() if token and isinstance(token, str) else None
    }

    # Try decoding parts
    if token and isinstance(token, str):
        parts = token.split('.')
        response["num_parts"] = len(parts)

        if len(parts) == 3:
            try:
                response["header"] = json.loads(base64.b64decode(parts[0] + "==").decode('utf-8'))
            except:
                response["header"] = "decode_error"

            try:
                response["payload"] = json.loads(base64.b64decode(parts[1] + "==").decode('utf-8'))
            except:
                response["payload"] = "decode_error"

    return response
