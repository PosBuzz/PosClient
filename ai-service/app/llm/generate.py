from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
from app.core.cache import description_cache
from app.services.service_factory import search_service
import logging
import datetime
import json

logger = logging.getLogger(__name__)

# Use the updated OllamaLLM class instead of deprecated Ollama
llm = OllamaLLM(model="mistral")

# Updated prompt template to include search context
context_prompt = PromptTemplate.from_template(
    """Generate a short, factual product description (max 30 words) for '{product}', suitable for a POS system. 
    The product is commonly available in Bangladesh. Focus on key features and usage.
    
    People often search for this product using these terms:
    {search_terms}
    
    Make sure your description addresses these common search intents."""
)

# Fallback prompt without context
basic_prompt = PromptTemplate.from_template(
    "Generate a short, factual product description (max 30 words) for '{product}', suitable for a POS system. The product is commonly available in Bangladesh. Focus on key features and usage."
)


async def generate_description(product: str, force_refresh: bool = False):
    """Generate product description with context aware caching"""
    try:
        # Get search context from selected service
        search_context = await search_service.get_search_context(product)
        logger.info(f"Obtained search context for '{product}': {len(search_context.get('queries', [])) if search_context else 0} queries")
        
        # Log the actual queries to see if they're changing
        if search_context and search_context.get('queries'):
            logger.debug(f"Queries for {product}: {', '.join(search_context.get('queries', []))}")
        
        # Generate cache key based on product and context
        cache_key = description_cache.generate_key(product, search_context)
        logger.info(f"Cache key for '{product}': {cache_key}")
        
        # Debug - dump in-memory cache keys
        cache_keys = list(description_cache.in_memory_cache.keys())
        logger.debug(f"In-memory cache has {len(cache_keys)} keys: {cache_keys[:5] if cache_keys else 'none'}")
        
        # Check if this exact key exists
        key_exists = cache_key in description_cache.in_memory_cache
        logger.info(f"Cache key '{cache_key}' exists in memory cache: {key_exists}")
        
        # Check cache first unless force refresh is specified
        if not force_refresh:
            cached_result = await description_cache.get(cache_key)
            if cached_result:
                logger.info(f"Cache HIT for key: {cache_key}")
                # Check if context is still fresh (less than 7 days old)
                if cached_result.get('timestamp'):
                    cache_time = datetime.datetime.fromisoformat(cached_result['timestamp'])
                    now = datetime.datetime.now()
                    if (now - cache_time).days < 7:
                        logger.info(f"Using cached description for product: {product}")
                        return cached_result['description']
            else:
                logger.info(f"Cache MISS for key: {cache_key}")
                
        # If we get here, we need to generate a new description
        logger.info(f"Generating new description for product: {product}")
        
        # Use context if available
        if search_context and search_context.get('queries'):
            search_terms = "\n".join([f"- {query}" for query in search_context['queries']])
            logger.debug(f"Using search terms: {search_terms}")
            chain = context_prompt | llm
            description = await chain.ainvoke({  # Use ainvoke for async
                "product": product,
                "search_terms": search_terms
            })
        else:
            logger.warning(f"No search context available for {product}, using basic prompt")
            chain = basic_prompt | llm
            description = await chain.ainvoke({"product": product})  # Use ainvoke for async
        
        # Store in cache
        cache_data = {
            "description": description,
            "product": product,
            "context": search_context,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        cache_success = await description_cache.set(cache_key, cache_data)
        if cache_success:
            logger.info(f"Description cached for product: {product}")
        else:
            logger.warning(f"Failed to cache description for product: {product}")
        
        return description
    except Exception as e:
        logger.error(f"Error in generate_description: {str(e)}", exc_info=True)
        # Return a basic description as fallback
        return f"A {product} available in Bangladesh."  # Simple fallback
