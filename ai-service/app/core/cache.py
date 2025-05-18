import json
import hashlib
import time
from typing import Dict, Optional, Any
import redis
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class DescriptionCache:
    def __init__(self):
        self.redis_client = None
        self.cache_ttl = settings.CACHE_TTL  # Time in seconds (e.g. 86400 for 1 day)
        self.in_memory_cache = {}  # Fallback cache
        self.connection_retry_limit = 3
        self.retry_delay = 1  # seconds
        self.use_in_memory_fallback = True
        
    async def connect(self):
        """Connect to Redis cache"""
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=0,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            # Fallback to memory cache if Redis is unavailable
            self.redis_client = None
            logger.info("Using in-memory cache as fallback")
    
    def generate_key(self, product: str, context: Dict) -> str:
        """Generate a unique cache key based on product and context queries (ignoring timestamps)"""
        try:
            # Extract just the queries for consistent cache keys
            query_list = sorted(context.get('queries', []))
            
            # Standardize the queries (lowercase, trim)
            query_list = [q.lower().strip() for q in query_list]
            
            context_str = json.dumps(query_list, sort_keys=True)
            combined = f"{product.lower().strip()}:{context_str}"
            
            key = hashlib.md5(combined.encode()).hexdigest()
            logger.debug(f"Generated key '{key}' from product '{product}' and {len(query_list)} queries")
            return key
        except Exception as e:
            logger.error(f"Error generating cache key: {e}")
            # Fallback to simple key
            return hashlib.md5(product.lower().encode()).hexdigest()
    
    async def _try_redis_operation(self, operation, *args, **kwargs):
        """Try a Redis operation with retries"""
        for attempt in range(self.connection_retry_limit):
            try:
                if self.redis_client:
                    return operation(*args, **kwargs)
            except redis.exceptions.ConnectionError as e:
                logger.warning(f"Redis connection error (attempt {attempt+1}): {e}")
                # Try to reconnect
                await self.connect()
                time.sleep(self.retry_delay)
            except Exception as e:
                logger.error(f"Redis error: {e}")
                break
                
        return None
    
    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached description"""
        # Try Redis first if available
        if self.redis_client:
            try:
                redis_result = await self._try_redis_operation(
                    self.redis_client.get,
                    key
                )
                if redis_result:
                    return json.loads(redis_result)
            except Exception as e:
                logger.error(f"Cache retrieval error: {e}")
        
        # Fall back to in-memory if Redis fails and fallback is enabled
        if self.use_in_memory_fallback and key in self.in_memory_cache:
            logger.info(f"Using in-memory cache for key: {key}")
            return self.in_memory_cache.get(key)
            
        return None
    
    async def set(self, key: str, value: Dict[str, Any]) -> bool:
        """Store description in cache"""
        # Always update in-memory cache for fallback
        if self.use_in_memory_fallback:
            self.in_memory_cache[key] = value
            
        # Try Redis if available
        if self.redis_client:
            try:
                redis_result = await self._try_redis_operation(
                    self.redis_client.setex,
                    key, 
                    self.cache_ttl,
                    json.dumps(value)
                )
                return redis_result is not None
            except Exception as e:
                logger.error(f"Cache storage error: {e}")
                
        return self.use_in_memory_fallback  # Return True if we stored it in memory
            
    async def invalidate(self, key: str) -> bool:
        """Invalidate a cache entry"""
        success = False
        
        # Remove from in-memory cache
        if self.use_in_memory_fallback and key in self.in_memory_cache:
            del self.in_memory_cache[key]
            success = True
            
        # Try Redis if available
        if self.redis_client:
            try:
                redis_result = await self._try_redis_operation(
                    self.redis_client.delete,
                    key
                )
                return redis_result is not None
            except Exception as e:
                logger.error(f"Cache invalidation error: {e}")
                
        return success
    
    async def debug_cache_state(self):
        """Log the current state of the cache for debugging"""
        memory_keys = list(self.in_memory_cache.keys())
        logger.info(f"In-memory cache contains {len(memory_keys)} items")
        
        if len(memory_keys) > 0:
            logger.info(f"Sample keys: {memory_keys[:5]}")
            logger.info(f"Sample item: {json.dumps(list(self.in_memory_cache.values())[0], indent=2)[:300]}...")
            
        if self.redis_client:
            try:
                # Get all keys matching our pattern
                redis_keys = self.redis_client.keys("*")
                logger.info(f"Redis cache contains {len(redis_keys)} items")
                if len(redis_keys) > 0:
                    logger.info(f"Sample Redis keys: {redis_keys[:5]}")
                    sample_data = self.redis_client.get(redis_keys[0])
                    if sample_data:
                        logger.info(f"Sample Redis data: {sample_data[:300]}...")
            except Exception as e:
                logger.error(f"Error getting Redis keys: {e}")
        else:
            logger.warning("Redis client not available")

# Create singleton instance
description_cache = DescriptionCache()