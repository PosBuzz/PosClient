from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.llm.generate import generate_description
from app.core.auth import verify_jwt

router = APIRouter()

class ProductInput(BaseModel):
    product: str
    force_refresh: bool = False

@router.post("/generate-description")
async def generate(input_data: ProductInput, user_data=Depends(verify_jwt)):
    description = await generate_description(
        input_data.product, 
        force_refresh=input_data.force_refresh
    )
    return {"description": description}
