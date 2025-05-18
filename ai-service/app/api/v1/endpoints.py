from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.llm.generate import generate_description
from app.core.auth import verify_jwt

router = APIRouter()

class ProductInput(BaseModel):
    product: str

@router.post("/generate-description")
def generate(input_data: ProductInput, user_data=Depends(verify_jwt)):
    description = generate_description(input_data.product)
    return {"description": description}
