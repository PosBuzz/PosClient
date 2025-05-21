import asyncio
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
    num_gpu=settings.LLM_NUM_GPU,
    num_thread=settings.LLM_NUM_THREAD,
    num_ctx=settings.LLM_NUM_CTX,
    repeat_penalty=settings.LLM_REPEAT_PENALTY
)

# Updated prompt template with examples from similar products
context_prompt = PromptTemplate.from_template(
    """You are generating a product description which is generally available in Bangladesh. It's for a description field when adding product in a Point of Sale (POS) system.

    REQUIREMENTS:
    1. Maximum 30 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. No mentions of websites, stores, or specific locations  where it be can found
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
    4. No mentions of websites, stores, or specific locations where it can be found
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
    """Get similar examples from the vector store"""
    try:
        logger.info(f"Finding similar examples for: {product}")
        start_time = time.time()
        
        # Make sure embeddings are initialized
        vector_store.ensure_embeddings_initialized()
        
        results = await vector_store.find_similar(product, limit=3)
        elapsed = time.time() - start_time
        logger.info(f"Found {len(results)} similar examples in {elapsed:.3f}s")
        
        # Enhanced debug logging to see the full result format
        if results:
            logger.debug(f"First result format: {results[0]}")
            # Log the actual document content for debugging
            doc = results[0].get("document", "")
            logger.debug(f"Document content: '{doc}'")
        
        # Format examples for the prompt
        if not results:
            return "No similar examples found."
        
        examples = []
        for result in results:
            doc = result.get("document", "")
            logger.debug(f"Processing document: '{doc}'")
            
            if doc:
                # Try different parsing approaches
                if "Description:" in doc:
                    parts = doc.split("Description:")
                    if len(parts) > 1:
                        product_part = parts[0].replace("Product:", "").strip()
                        desc_part = parts[1].strip()
                        examples.append(f"Example: '{product_part}' -> '{desc_part}'")
                        logger.debug(f"Extracted example with standard format")
                elif ":" in doc:
                    # Alternative parsing if the format is different
                    parts = doc.split(":", 1)  # Split on first colon only
                    if len(parts) > 1:
                        product_part = parts[0].strip()
                        desc_part = parts[1].strip()
                        examples.append(f"Example: '{product_part}' -> '{desc_part}'")
                        logger.debug(f"Extracted example with alternative format")
                else:
                    # If the document appears to be just the description
                    logger.debug(f"Document doesn't contain expected format, using as-is")
                    examples.append(f"Example: similar product -> '{doc}'")
        
        # Check if we successfully parsed any examples
        if examples:
            logger.debug(f"Successfully parsed {len(examples)} examples")
            return "\n".join(examples)
        else:
            logger.debug(f"No examples could be parsed from {len(results)} results")
            return "No similar examples found."
    except Exception as e:
        logger.error(f"Error getting similar examples: {str(e)}")
        return "Error retrieving similar examples."


async def generate_description(product: str, force_refresh: bool = False):
    try:
        logger.info(f"Force Refresh {force_refresh}")
        
        # Clear vector store cache if force refreshing
        if force_refresh:
            await vector_store.clear_cache()
            
        # Start all async operations in parallel
        cache_task = description_cache.get(
            description_cache.generate_key(product, {}))
        search_task = search_service.get_search_context(product)
        similar_examples_task = get_similar_examples(product)
        history_task = history_manager.get_latest_version(product)

        # logger.info(similar_examples)

        # Wait for all results simultaneously
        results = await asyncio.gather(
            cache_task, search_task, similar_examples_task, history_task,
            return_exceptions=True
        )
        
        # Process results (handle exceptions for each task)
        cached_result = results[0] if not isinstance(results[0], Exception) else None
        search_context = results[1] if not isinstance(results[1], Exception) else {}
        similar_examples = results[2] if not isinstance(results[2], Exception) else ""
        latest_version = results[3] if not isinstance(results[3], Exception) else None

        # Log search context details
        if isinstance(search_context, Exception):
            logger.error(f"Error getting search context: {str(search_context)}")
        else:
            queries = search_context.get('queries', [])
            logger.info(f"Search service returned {len(queries)} queries for '{product}': {queries}")

        # Process results (handle exceptions for each task)
        if not isinstance(cached_result, Exception) and not force_refresh and cached_result:
            return cached_result['description']

        # Generate cache key based on product and context
        cache_key = description_cache.generate_key(product, search_context if isinstance(search_context, dict) else {})

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

        # Use the similar_examples result from gather
        if similar_examples and similar_examples != "No similar examples found." and similar_examples != "Error retrieving similar examples.":
            logger.info(f"Using {similar_examples.count('Example:') or 0} similar examples for: {product}")
        else:
            logger.info(f"No usable similar examples found for: {product}")

        # First try to get the latest high-quality version from history
        latest_version = None
        try:
            if not isinstance(results[3], Exception):
                latest_version = results[3]  # Already awaited by asyncio.gather
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
        if isinstance(search_context, dict) and search_context.get('queries'):
            # Use only the top 5 most relevant search terms
            queries = search_context.get('queries') or []
            top_queries = queries[:5]
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
        if isinstance(search_context, dict):
            asyncio.create_task(add_to_learning_systems(
                product, description, search_context))

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

            logger.debug(
                f"Cleaned up {len(expired_keys)} expired similar example cache entries")

        except Exception as e:
            logger.error(f"Error in cache cleanup: {str(e)}")
            await asyncio.sleep(300)

# Start the cache cleanup task when this module is imported
asyncio.create_task(cleanup_caches())
