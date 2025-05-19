import logging
from typing import Dict, Any
import datetime
import requests
from bs4 import BeautifulSoup
import time

logger = logging.getLogger(__name__)

class DuckDuckGoService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        # Simple in-memory cache for search results
        self.search_cache = {}
        self.cache_ttl = 3600  # 1 hour in seconds
        
    def connect(self):
        """No connection needed for this service"""
        return True
            
    async def get_search_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Get search context related to a product via DuckDuckGo"""
        # Generate cache key for this search
        product_key = product.lower()
        
        # Check cache first
        if product_key in self.search_cache:
            cache_entry = self.search_cache[product_key]
            # Check if cache is still valid
            if (time.time() - cache_entry['timestamp']) < self.cache_ttl:
                return cache_entry['context']
        
        try:
            # Format the query
            query = f"{product} commonly available in Bangladesh"
            url = f"https://html.duckduckgo.com/html/?q={query}"
            
            response = requests.get(url, headers=self.headers)
            if response.status_code != 200:
                return self._get_fallback_context(product, limit)
            
            # Parse the results
            soup = BeautifulSoup(response.text, 'html.parser')
            results = soup.find_all('a', class_='result__a')
            
            queries = []
            for result in results[:limit]:
                if result.text:
                    queries.append(result.text.strip())
            
            # If we didn't get enough results, add generic ones
            if len(queries) < limit:
                generic = self._get_fallback_context(product, limit - len(queries))["queries"]
                queries.extend(generic)
            
            # Create context object
            context = {
                "queries": queries[:limit],
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            # Cache the results
            self.search_cache[product_key] = {
                'context': context,
                'timestamp': time.time()
            }
            
            return context
        except Exception:
            return self._get_fallback_context(product, limit)
    
    def _get_fallback_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Generate fallback context when DuckDuckGo fails"""
        queries = [
            f"Best {product} brands in Bangladesh",
            f"{product} features and benefits",
            f"How to choose quality {product}",
            f"{product} price comparison",
            f"Popular {product} types in market"
        ]
        
        return {
            "queries": queries[:limit],
            "timestamp": datetime.datetime.now().isoformat()
        }

# Create singleton instance
duckduckgo_service = DuckDuckGoService()