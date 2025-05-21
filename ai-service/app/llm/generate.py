from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
from functools import lru_cache
from typing import Dict, Any, List, Optional
import logging
import asyncio
import time
import datetime
import hashlib
from app.core.cache import description_cache
from app.services.service_factory import search_service
from app.core.vector_store import vector_store
from app.core.history import history_manager
from app.core.background_learning import background_learner
from app.core.config import settings
from app.core.feedback import feedback_manager

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

# Updated prompt template with examples from similar products and feedback
context_prompt = PromptTemplate.from_template(
    """You are generating a product description which is generally available in Bangladesh. It's for a description field when adding product in a Point of Sale (POS) system.

    MUST FOLLOW:
    1. Maximum 15 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. Don't mention of websites, stores, or specific locations where it be can found
    5. Simple, factual information only
    6. No pricing information
    7. Analyze the whole context and give most relevant result But dont tell like "Based on the provided context,",

    {similar_examples}

    {feedback_insights}

    Product: '{product}'

    Common search terms:
    {search_terms}

    PRODUCT DESCRIPTION:"""
)

# Similar examples prompt component
similar_examples_template = """EXAMPLES OF SIMILAR PRODUCT DESCRIPTIONS:
{examples}
"""

# Feedback insights template
feedback_insights_template = """USER FEEDBACK INSIGHTS:
{feedback_insights}
"""

# Fallback prompt without context
basic_prompt = PromptTemplate.from_template(
    """You are generating a product description for a Point of Sale (POS) system.

    MUST FOLLOW:
    1. Maximum 15 words
    2. Focus only on product features and type
    3. No marketing language or flowery descriptions
    4. Don't mention of websites, stores, or specific locations where it can be found
    5. Simple, factual information only
    6. No pricing information
    7. Analyze the whole context and give most relevant result But dont tell like "Based on the provided context,", 

    {similar_examples}

    {feedback_insights}

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

        # Format examples for the prompt
        if not results:
            return "No similar examples found."

        examples = []
        for result in results:
            if "description" in result and result["description"]:
                product_name = result.get("product", "Unknown product")
                description = result["description"]
                examples.append(f"Product: {product_name}\nDescription: {description}")

        # Check if we successfully parsed any examples
        if examples:
            return similar_examples_template.format(examples="\n".join(examples))
        else:
            return "No similar examples found."
    except Exception as e:
        logger.error(f"Error getting similar examples: {str(e)}")
        return "Error retrieving similar examples."


async def process_feedback_for_product(product: str, feedback_items: List[Dict]) -> str:
    """Process feedback to extract insights for description generation"""
    if not feedback_items:
        return ""
    
    try:
        # Filter for high quality feedback (above threshold)
        high_quality = [item for item in feedback_items 
                        if item.get('rating', 0) >= settings.FEEDBACK_QUALITY_THRESHOLD]
        
        if not high_quality:
            return ""
            
        # Extract user-edited descriptions which are highly rated
        edited_descriptions = []
        for item in high_quality:
            if item.get('user_edited_description'):
                edited_descriptions.append(item['user_edited_description'])
        
        # Extract comments
        comments = [item.get('comment') for item in high_quality if item.get('comment')]
        
        insights = []
        
        # Add most common user edits if available
        if edited_descriptions:
            insights.append(f"User-preferred description: {edited_descriptions[0]}")
        
        # Add relevant comments (limit to 2 to avoid prompt bloat)
        if comments:
            insights.append("User feedback suggests:")
            for comment in comments[:2]:
                insights.append(f"- {comment}")
        
        if insights:
            return feedback_insights_template.format(feedback_insights="\n".join(insights))
        return ""
        
    except Exception as e:
        logger.error(f"Error processing feedback insights: {str(e)}")
        return ""


async def generate_description(product: str, force_refresh: bool = False):
    try:
        logger.info(f"Force Refresh {force_refresh}")

        # Clear vector store cache if force refreshing
        if force_refresh:
            # Modified: Remove the parameter from clear_cache call
            await vector_store.clear_cache()

        # Start all async operations in parallel
        cache_task = description_cache.get(description_cache.generate_key(product, {}))
        search_task = search_service.get_search_context(product)
        similar_examples_task = get_similar_examples(product)
        history_task = history_manager.get_latest_version(product)
        feedback_task = feedback_manager.get_product_feedback(product)  # Get feedback for this product

        # Wait for all results simultaneously
        results = await asyncio.gather(
            cache_task, search_task, similar_examples_task, history_task, feedback_task,
            return_exceptions=True
        )

        # Process results (handle exceptions for each task)
        cached_result = results[0] if not isinstance(results[0], Exception) else None
        search_context = results[1] if not isinstance(results[1], Exception) else {}
        similar_examples = results[2] if not isinstance(results[2], Exception) else ""
        latest_version = results[3] if not isinstance(results[3], Exception) else None
        product_feedback = results[4] if not isinstance(results[4], Exception) else []

        # Process feedback insights
        feedback_insights = await process_feedback_for_product(product, product_feedback)

        # Log search context details
        if isinstance(search_context, dict):
            logger.debug(f"Search context for '{product}': {search_context}")

        # Generate cache key based on product and context
        cache_key = description_cache.generate_key(
            product, search_context if isinstance(search_context, dict) else {})

        # Check cache first unless force refresh is specified
        if not force_refresh and cached_result:
            logger.info(f"Cache hit for: {product}")
            # Add to background learning if not already
            asyncio.create_task(background_learner.add_popular_product(product))
            return cached_result.get('description', f"A {product} available in Bangladesh.")

        # Generate a new description
        logger.info(f"Generating new description for: {product}")

        # First try to get the latest high-quality version from history
        if latest_version and not force_refresh:
            if datetime.datetime.now() - datetime.datetime.fromisoformat(latest_version.get('timestamp', '')) < datetime.timedelta(days=30):
                description = latest_version.get('description')
                if description:
                    logger.info(f"Using recent version from history for: {product}")
                    return description

        # Use context if available
        if isinstance(search_context, dict) and search_context.get('queries'):
            search_terms = "\n".join(search_context.get('queries', []))
            prompt = context_prompt.format(
                product=product,
                search_terms=search_terms,
                similar_examples=similar_examples,
                feedback_insights=feedback_insights
            )
        else:
            prompt = basic_prompt.format(
                product=product, 
                similar_examples=similar_examples,
                feedback_insights=feedback_insights
            )

        # Generate description with LLM
        logger.debug(f"Using prompt: {prompt}")
        description = llm.invoke(prompt)

        # Clean up the response - remove any extra text or formatting
        description = description.strip()
        lines = description.split('\n')
        # Take only the first non-empty line
        for line in lines:
            line = line.strip()
            if line:
                description = line
                break

        # Create a background task for all post-processing
        # This ensures we return the description immediately
        # Only pass search_context if it's a dict, otherwise use an empty dict
        context_to_pass = search_context if isinstance(search_context, dict) else {}
        asyncio.create_task(post_process_description(
            product, description, cache_key, context_to_pass))

        # Return the description immediately
        return description
    except Exception as e:
        logger.error(f"Error generating description: {str(e)}")
        return f"A {product} available in Bangladesh."  # Simple fallback


async def post_process_description(product: str, description: str, cache_key: str, search_context: Dict):
    """Handle all post-processing tasks after returning the description"""
    try:
        # Store in cache
        cache_data = {
            "description": description,
            "product": product,
            "context": search_context,
            "timestamp": datetime.datetime.now().isoformat()
        }

        await description_cache.set(cache_key, cache_data)
        logger.info(f"Cached new description for: {product}")

        # Add to learning systems if context is available
        if isinstance(search_context, dict):
            await add_to_learning_systems(product, description, search_context)
            
        # Store version history
        await history_manager.store_version(product, description, search_context)
            
        # Add to background learning
        await background_learner.add_popular_product(product)
    except Exception as e:
        logger.error(f"Error in post-processing: {str(e)}")


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
            context=search_context
        )
    except Exception as e:
        logger.error(f"Error adding to learning systems: {str(e)}")


# Clean caches periodically
async def cleanup_caches():
    """Clean up in-memory caches periodically"""
    while True:
        try:
            await asyncio.sleep(3600)  # Clean up every hour
            similar_examples_cache.clear()
            logger.info("Cleared in-memory similar examples cache")
        except Exception as e:
            logger.error(f"Error cleaning up caches: {str(e)}")
            await asyncio.sleep(300)  # Wait 5 minutes before retrying

# Start the cache cleanup task when this module is imported
asyncio.create_task(cleanup_caches())
