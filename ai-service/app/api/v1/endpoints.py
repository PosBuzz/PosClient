

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.llm.generate import generate_description
from app.core.auth import verify_jwt  # optional if JWT is used

router = APIRouter()

class ProductInput(BaseModel):
    name: str

@router.post("/generate-description")
def generate(product: ProductInput, user_data=Depends(verify_jwt)):  # remove verify_jwt if not using
    description = generate_description(product.name)
    return {"description": description}
