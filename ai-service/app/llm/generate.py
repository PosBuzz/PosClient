from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
from app.core.cache import description_cache
from app.services.service_factory import search_service
import logging
import datetime

logger = logging.getLogger(__name__)

# Use the updated OllamaLLM class
llm = OllamaLLM(model="mistral")

# Updated prompt template with strict instructions for POS-appropriate descriptions
context_prompt = PromptTemplate.from_template(
    """You are generating a product description for a Point of Sale (POS) system.

    REQUIREMENTS:
    1. Maximum 15 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. No mentions of websites, stores, or specific locations
    5. Simple, factual information only
    6. No pricing information

    Product: '{product}'

    Common search terms:
    {search_terms}

    PRODUCT DESCRIPTION:"""
)

# Fallback prompt without context
basic_prompt = PromptTemplate.from_template(
    """You are generating a product description for a Point of Sale (POS) system.

    REQUIREMENTS:
    1. Maximum 40 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. No mentions of websites, stores, or specific locations
    5. Simple, factual information only
    6. No pricing information
    8. Analyze the whole context and give most relevant result
    9. IF YOU DON'T KNOW OR HAVE ENOUGH OR RELEVANT CONTEXT SAY "Sorry, I don't have correct info about the specified product."

    Product: '{product}'

    PRODUCT DESCRIPTION:"""
)


async def generate_description(product: str, force_refresh: bool = False):
    """Generate product description with context aware caching"""
    try:
        # Get search context from selected service
        search_context = await search_service.get_search_context(product)
        
        # Log number of search results
        if search_context and "queries" in search_context:
            logger.info(f"Found {len(search_context['queries'])} search context items for: {product}")

        # Generate cache key based on product and context
        cache_key = description_cache.generate_key(product, search_context)

        # Check cache first unless force refresh is specified
        if not force_refresh:
            cached_result = await description_cache.get(cache_key)
            if cached_result:
                # Check if context is still fresh (less than 7 days old)
                if cached_result.get('timestamp'):
                    cache_time = datetime.datetime.fromisoformat(
                        cached_result['timestamp'])
                    now = datetime.datetime.now()
                    if (now - cache_time).days < 7:
                        logger.info(f"Using cached description for: {product}")
                        return cached_result['description']

        # Generate a new description
        logger.info(f"Generating new description for: {product}")

        # Use context if available
        if search_context and search_context.get('queries'):
            # Use only the top 5 most relevant search terms
            top_queries = search_context.get('queries')[:5]
            search_terms = "\n".join([f"- {query}" for query in top_queries])
            
            # Log the terms we're using
            logger.debug(f"Using search terms for {product}: {search_terms}")
            
            chain = context_prompt | llm
            description = await chain.ainvoke({
                "product": product,
                "search_terms": search_terms
            })
        else:
            logger.info(f"No search context available for {product}, using basic prompt")
            chain = basic_prompt | llm
            description = await chain.ainvoke({"product": product})

        # Clean up the response - remove any extra text or formatting
        description = description.strip()
        lines = description.split('\n')
        # Take only the first non-empty line
        for line in lines:
            if line.strip():
                description = line.strip()
                break

        # Store in cache
        cache_data = {
            "description": description,
            "product": product,
            "context": search_context,
            "timestamp": datetime.datetime.now().isoformat()
        }

        await description_cache.set(cache_key, cache_data)
        logger.info(f"Cached new description for: {product}")

        return description
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        return f"A {product} available in Bangladesh."  # Simple fallback
