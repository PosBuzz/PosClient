#!/bin/bash
# Script to check if all AI service dependencies are ready

echo "🔍 Checking PosBuzz AI Service Dependencies..."
echo ""

# Check if Ollama is running
echo "1. Checking Ollama service..."
if docker-compose ps ollama | grep -q "Up"; then
    echo "   ✅ Ollama is running"
    
    # Check if model is downloaded
    echo ""
    echo "2. Checking Ollama model..."
    MODEL=$(docker-compose exec ollama ollama list 2>/dev/null | grep -E "llama3|mistral" | head -n 1)
    if [ ! -z "$MODEL" ]; then
        echo "   ✅ Ollama model is downloaded:"
        docker-compose exec ollama ollama list
    else
        echo "   ⚠️  No Ollama model found!"
        echo "   Run: docker-compose exec ollama ollama pull llama3:8b-instruct-q8_0"
    fi
else
    echo "   ❌ Ollama is not running"
fi

echo ""
echo "3. Checking AI Service..."
if docker-compose ps ai-service | grep -q "Up"; then
    echo "   ✅ AI Service is running"
    
    # Check if embeddings are initialized
    echo ""
    echo "4. Checking HuggingFace cache..."
    CACHE_SIZE=$(docker-compose exec ai-service du -sh /app/.cache/huggingface 2>/dev/null | cut -f1)
    if [ ! -z "$CACHE_SIZE" ]; then
        echo "   ✅ HuggingFace cache: $CACHE_SIZE"
        echo "   (Should be ~90MB when fully initialized)"
    else
        echo "   ⚠️  HuggingFace cache not accessible"
    fi
    
    # Check ChromaDB
    echo ""
    echo "5. Checking ChromaDB..."
    CHROMA_FILES=$(docker-compose exec ai-service ls /app/data/chroma_db 2>/dev/null | wc -l)
    if [ "$CHROMA_FILES" -gt 0 ]; then
        echo "   ✅ ChromaDB initialized ($CHROMA_FILES files)"
    else
        echo "   ℹ️  ChromaDB will initialize on first use"
    fi
else
    echo "   ❌ AI Service is not running"
fi

echo ""
echo "6. Checking AI Service health..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/v1/health 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    echo "   ✅ AI Service is healthy (HTTP 200)"
else
    echo "   ⚠️  AI Service health check failed (HTTP $HEALTH)"
    echo "   Check logs: docker-compose logs ai-service"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   - Ollama models stored in: ollama_data volume"
echo "   - HuggingFace models stored in: huggingface_cache volume"
echo "   - ChromaDB/SQLite stored in: ai_service_data volume"
echo ""
echo "💡 Useful commands:"
echo "   docker-compose logs -f ai-service     # Watch AI service logs"
echo "   docker-compose exec ollama ollama list # List Ollama models"
echo "   docker volume ls                       # List all volumes"
echo ""
