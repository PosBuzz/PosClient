# AI Service Dockerfile (FastAPI + Python)
FROM python:3.11-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directories and cache directory for HuggingFace models
RUN mkdir -p data/chroma_db data/feedback /app/.cache/huggingface && \
    chmod -R 777 data /app/.cache

# Create non-root user
RUN useradd -m -u 1001 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

# Set HuggingFace cache directory
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/huggingface

EXPOSE 8001

# Use production server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
