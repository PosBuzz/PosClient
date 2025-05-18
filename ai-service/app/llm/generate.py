from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
from app.core.cache import description_cache
from app.services.service_factory import search_service
import logging
import datetime

logger = logging.getLogger(__name__)

# Use the updated OllamaLLM class
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
        
        # Generate cache key based on product and context
        cache_key = description_cache.generate_key(product, search_context)
        
        # Check cache first unless force refresh is specified
        if not force_refresh:
            cached_result = await description_cache.get(cache_key)
            if cached_result:
                # Check if context is still fresh (less than 7 days old)
                if cached_result.get('timestamp'):
                    cache_time = datetime.datetime.fromisoformat(cached_result['timestamp'])
                    now = datetime.datetime.now()
                    if (now - cache_time).days < 7:
                        return cached_result['description']
                
        # Generate a new description
        logger.info(f"Generating description for: {product}")
        
        # Use context if available
        if search_context and search_context.get('queries'):
            search_terms = "\n".join([f"- {query}" for query in search_context['queries']])
            chain = context_prompt | llm
            description = await chain.ainvoke({
                "product": product,
                "search_terms": search_terms
            })
        else:
            chain = basic_prompt | llm
            description = await chain.ainvoke({"product": product})
        
        # Store in cache
        cache_data = {
            "description": description,
            "product": product,
            "context": search_context,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        await description_cache.set(cache_key, cache_data)
        
        return description
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        return f"A {product} available in Bangladesh."  # Simple fallback
