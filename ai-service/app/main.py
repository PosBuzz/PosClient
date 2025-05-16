from fastapi import FastAPI
from app.core.config import settings
from app.api.v1 import endpoints

app = FastAPI(title=settings.APP_NAME)

# Include routes
app.include_router(endpoints.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to the AI microservice!"}
