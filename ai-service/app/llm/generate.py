from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
import logging
import datetime
import hashlib
from functools import lru_cache
import time
from typing import Dict, Any, List, Optional  # Add this line to import Dict
from app.core.cache import description_cache
from app.services.service_factory import search_service
from app.core.vector_store import vector_store
from app.core.history import history_manager
from app.core.background_learning import background_learner
from app.core.config import settings  # Import settings

logger = logging.getLogger(__name__)

# Use the updated OllamaLLM class with caching
llm = OllamaLLM(
    model=settings.LLM_MODEL,
    temperature=settings.LLM_TEMPERATURE,
)

# Updated prompt template with examples from similar products
context_prompt = PromptTemplate.from_template(
    """You are generating a product description which is generally available in Bangladesh. It's for a description field when adding product in a Point of Sale (POS) system.

    REQUIREMENTS:
    1. Maximum 30 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. No mentions of websites, stores, or specific locations
    5. Simple, factual information only
    6. No pricing information
    7. Analyze the whole context and give most relevant result
    8. IF YOU DON'T KNOW OR HAVE ENOUGH OR RELEVANT CONTEXT SAY "Sorry, I don't have correct info about the specified product."

    {similar_examples}

    Product: '{product}'

    Common search terms:
    {search_terms}

    PRODUCT DESCRIPTION:"""
)

# Similar examples prompt component
similar_examples_template = """EXAMPLES OF SIMILAR PRODUCT DESCRIPTIONS:
{examples}
"""

# Fallback prompt without context
basic_prompt = PromptTemplate.from_template(
    """You are generating a product description for a Point of Sale (POS) system.

    REQUIREMENTS:
    1. Maximum 30 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. No mentions of websites, stores, or specific locations
    5. Simple, factual information only
    6. No pricing information
    7. Analyze the whole context and give most relevant result
    8. IF YOU DON'T KNOW OR HAVE ENOUGH OR RELEVANT CONTEXT SAY "Sorry, I don't have correct info about the specified product."

    {similar_examples}

    Product: '{product}'

    PRODUCT DESCRIPTION:"""
)

# In-memory cache for similar examples
similar_examples_cache = {}
similar_examples_ttl = 3600  # 1 hour


def generate_product_id(product: str) -> str:
    """Generate a consistent ID for a product"""
    normalized = product.lower().strip()
    return hashlib.md5(normalized.encode()).hexdigest()


async def get_similar_examples(product: str) -> str:
    """Get examples of similar product descriptions with caching"""
    cache_key = product.lower().strip()
    
    # Check memory cache first
    if cache_key in similar_examples_cache:
        cache_entry = similar_examples_cache[cache_key]
        if time.time() - cache_entry['timestamp'] < similar_examples_ttl:
            return cache_entry['result']
    
    # Fetch from vector store if not in cache
    similar_descriptions = await vector_store.find_similar(product, limit=3)

    if not similar_descriptions:
        result = ""
    else:
        # Format examples
        example_texts = []
        for item in similar_descriptions:
            example_texts.append(item["document"])

        if example_texts:
            result = similar_examples_template.format(
                examples="\n\n".join(example_texts)
            )
        else:
            result = ""
    
    # Store in cache
    similar_examples_cache[cache_key] = {
        'timestamp': time.time(),
        'result': result
    }
    
    return result


async def generate_description(product: str, force_refresh: bool = False):
    """Generate product description with optimized caching and continual learning"""
    try:
        logger.info(f"Generating description for '{product}' (force_refresh: {force_refresh})")
        
        # Get search context from selected service
        search_context = await search_service.get_search_context(product)

        # Log number of search results
        if search_context and "queries" in search_context:
            logger.info(
                f"Found {len(search_context['queries'])} search context items for: {product}")

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

        # Get similar examples
        similar_examples = await get_similar_examples(product)
        logger.info(
            f"Found {len(similar_examples) > 0} similar examples for: {product}")
        
        # First try to get the latest high-quality version from history
        latest_version = None
        try:
            latest_version = await history_manager.get_latest_version(product)
        except Exception as e:
            logger.warning(f"Error getting latest version: {str(e)}")

        # Use the latest version if it exists and is recent (less than 30 days old)
        if latest_version and not force_refresh:
            try:
                version_time = datetime.datetime.fromisoformat(
                    latest_version.get('timestamp', '2020-01-01T00:00:00'))
                now = datetime.datetime.now()
                
                if (now - version_time).days < 30:
                    logger.info(f"Using latest version for: {product}")
                    description = latest_version.get('description')
                    
                    # Still store in cache for faster retrieval
                    cache_data = {
                        "description": description,
                        "product": product,
                        "context": search_context,
                        "timestamp": datetime.datetime.now().isoformat()
                    }
                    
                    await description_cache.set(cache_key, cache_data)
                    
                    return description
            except Exception as e:
                logger.error(f"Error using latest version: {str(e)}")

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
                "search_terms": search_terms,
                "similar_examples": similar_examples
            })
        else:
            logger.info(
                f"No search context available for {product}, using basic prompt")
            chain = basic_prompt | llm
            description = await chain.ainvoke({
                "product": product,
                "similar_examples": similar_examples
            })

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

        # Add to vector store for continuous learning - do this in the background
        asyncio.create_task(add_to_learning_systems(product, description, search_context))

        return description
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        return f"A {product} available in Bangladesh."  # Simple fallback


async def add_to_learning_systems(product: str, description: str, search_context: Dict):
    """Add to learning systems in the background to avoid blocking the response"""
    try:
        # Generate a stable ID
        product_id = generate_product_id(product)
        
        # Add to vector store
        await vector_store.add_description(
            product_id=product_id,
            product=product,
            description=description,
            context=search_context,
            metadata={"timestamp": datetime.datetime.now().isoformat()}
        )

        # Store version history
        if history_manager:
            await history_manager.store_version(
                product=product,
                description=description,
                context=search_context
            )

        # Add to popular products list for background learning
        await background_learner.add_popular_product(product)
        
        logger.info(f"Successfully added '{product}' to learning systems")
    except Exception as e:
        logger.error(f"Error adding to learning systems: {str(e)}")


# Clean caches periodically
async def cleanup_caches():
    """Clean up in-memory caches periodically"""
    while True:
        try:
            await asyncio.sleep(similar_examples_ttl)
            
            # Clear expired similar examples cache entries
            current_time = time.time()
            expired_keys = []
            
            for key, cache_entry in similar_examples_cache.items():
                if current_time - cache_entry['timestamp'] >= similar_examples_ttl:
                    expired_keys.append(key)
                    
            for key in expired_keys:
                del similar_examples_cache[key]
                
            logger.debug(f"Cleaned up {len(expired_keys)} expired similar example cache entries")
            
        except Exception as e:
            logger.error(f"Error in cache cleanup: {str(e)}")
            await asyncio.sleep(300)

# Start the cache cleanup task when this module is imported
import asyncio
asyncio.create_task(cleanup_caches())
