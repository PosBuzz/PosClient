from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.llm.generate import generate_description
from app.core.auth import verify_jwt
from app.core.feedback import feedback_manager

router = APIRouter()

class ProductInput(BaseModel):
    product: str
    force_refresh: bool = False
class FeedbackInput(BaseModel):
    product: str
    description: str
    rating: int  # 1-5 scale
    comment: Optional[str] = None
    user_edited_description: Optional[str] = None

@router.post("/generate-description")
async def generate(input_data: ProductInput, user_data=Depends(verify_jwt)):
    description = await generate_description(
        input_data.product, 
        force_refresh=input_data.force_refresh
    )
    return {"description": description}

@router.post("/feedback")
async def submit_feedback(feedback: FeedbackInput, user_data=Depends(verify_jwt)):
    """Submit feedback for a generated description"""
    if feedback.rating < 1 or feedback.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    result = await feedback_manager.store_feedback(
        product=feedback.product,
        description=feedback.description,
        rating=feedback.rating,
        comment=feedback.comment,
        user_edited_description=feedback.user_edited_description,
        user_id=user_data.get("sub") or user_data.get("email", "anonymous")
    )
    
    return {"success": result, "message": "Feedback recorded"}
