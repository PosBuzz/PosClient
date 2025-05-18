import json
import hashlib
import time
from typing import Dict, Optional, Any
import redis
from redis.exceptions import ConnectionError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class DescriptionCache:
    def __init__(self):
        self.redis_client = None
        self.cache_ttl = settings.CACHE_TTL  # Time in seconds (e.g. 86400 for 1 day)
        self.in_memory_cache = {}  # Fallback cache
        self.in_memory_timestamps = {}  # Track when items were added
        self.connection_retry_limit = 3
        self.retry_delay = 1  # seconds
        self.use_in_memory_fallback = True
        self.in_memory_max_size = 1000  # Maximum items
        
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
        except Exception:
            # Fallback to memory cache if Redis is unavailable
            self.redis_client = None
    
    def generate_key(self, product: str, context: Dict) -> str:
        """Generate a unique cache key based on product and context queries"""
        try:
            # Extract just the queries for consistent cache keys
            query_list = sorted(context.get('queries', []))
            query_list = [q.lower().strip() for q in query_list]
            
            context_str = json.dumps(query_list, sort_keys=True)
            combined = f"{product.lower().strip()}:{context_str}"
            
            return hashlib.md5(combined.encode()).hexdigest()
        except Exception:
            # Fallback to simple key
            return hashlib.md5(product.lower().encode()).hexdigest()
    
    async def _try_redis_operation(self, operation, *args, **kwargs):
        """Try a Redis operation with retries"""
        for attempt in range(self.connection_retry_limit):
            try:
                if self.redis_client:
                    return operation(*args, **kwargs)
            except ConnectionError:
                await self.connect()
                time.sleep(self.retry_delay)
            except Exception:
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
            except Exception:
                pass
        
        # Fall back to in-memory cache
        if self.use_in_memory_fallback and key in self.in_memory_cache:
            # Check if the entry has expired
            if key in self.in_memory_timestamps:
                if time.time() - self.in_memory_timestamps[key] > self.cache_ttl:
                    # Entry has expired, remove it
                    del self.in_memory_cache[key]
                    del self.in_memory_timestamps[key]
                    return None
            
            return self.in_memory_cache.get(key)
            
        return None
    
    async def set(self, key: str, value: Dict[str, Any]) -> bool:
        """Store description in cache"""
        # Always update in-memory cache for fallback
        if self.use_in_memory_fallback:
            # Check if we need to evict an item
            if len(self.in_memory_cache) >= self.in_memory_max_size:
                # Find oldest item
                if self.in_memory_timestamps:
                    oldest_key = min(self.in_memory_timestamps.items(), key=lambda x: x[1])[0]
                    del self.in_memory_cache[oldest_key]
                    del self.in_memory_timestamps[oldest_key]
                    
            self.in_memory_cache[key] = value
            self.in_memory_timestamps[key] = time.time()
            
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
            except Exception:
                pass
                
        return self.use_in_memory_fallback
            
    async def invalidate(self, key: str) -> bool:
        """Invalidate a cache entry"""
        success = False
        
        # Remove from in-memory cache
        if self.use_in_memory_fallback and key in self.in_memory_cache:
            del self.in_memory_cache[key]
            if key in self.in_memory_timestamps:
                del self.in_memory_timestamps[key]
            success = True
            
        # Try Redis if available
        if self.redis_client:
            try:
                redis_result = await self._try_redis_operation(
                    self.redis_client.delete,
                    key
                )
                return redis_result is not None
            except Exception:
                pass
                
        return success
    
    async def cleanup(self):
        """Remove expired items from in-memory cache"""
        now = time.time()
        keys_to_remove = []
        
        for key, timestamp in self.in_memory_timestamps.items():
            if now - timestamp > self.cache_ttl:
                keys_to_remove.append(key)
                
        for key in keys_to_remove:
            del self.in_memory_cache[key]
            del self.in_memory_timestamps[key]

# Create singleton instance
description_cache = DescriptionCache()