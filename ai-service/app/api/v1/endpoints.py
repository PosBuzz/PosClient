from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
import secrets
from app.llm.generate import generate_description
from app.core.auth import verify_jwt  # optional if JWT is used

router = APIRouter()


class ProductInput(BaseModel):
    product: str

@router.get("/csrf-token")
def get_csrf_token(response: Response):
    """Get a CSRF token to use with POST requests"""
    token = secrets.token_hex(16)
    response.set_cookie(key="csrf_token", value=token, httponly=True, secure=False)
    return {"csrfToken": token}

@router.post("/generate-description")
def generate(input_data: ProductInput, user_data=Depends(verify_jwt)):
    description = generate_description(input_data.product)
    return {"description": description}
