import logging
from typing import Dict, Any, List
import datetime
import requests
from bs4 import BeautifulSoup
import time
import random

logger = logging.getLogger(__name__)

class SearchService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
    def connect(self):
        """No connection needed for this service"""
        logger.info("Search service initialized with DuckDuckGo")
        return True
            
    async def get_search_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Get search context related to a product via DuckDuckGo"""
        try:
            # Format the query
            query = f"{product} features bangladesh"
            url = f"https://html.duckduckgo.com/html/?q={query}"
            
            response = requests.get(url, headers=self.headers)
            if response.status_code != 200:
                logger.warning(f"DuckDuckGo search failed with status {response.status_code}")
                return self._get_mock_context(product, limit)
            
            # Parse the results
            soup = BeautifulSoup(response.text, 'html.parser')
            results = soup.find_all('a', class_='result__a')
            
            queries = []
            for result in results[:limit]:
                if result.text:
                    queries.append(result.text.strip())
            
            # If we didn't get enough results
            if len(queries) < limit:
                mock_queries = self._get_mock_context(product, limit)["queries"]
                queries.extend(mock_queries[:(limit-len(queries))])
            
            return {
                "queries": queries[:limit],
                "timestamp": datetime.datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error fetching search data: {e}")
            return self._get_mock_context(product, limit)
    
    def _get_mock_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Generate mock search context when API is unavailable"""
        # Same mock implementation as before
        # ...
    
    def _stabilize_context(self, context):
        """Remove or standardize unstable elements from context"""
        # Example: Remove timestamp if present
        if isinstance(context, dict) and "timestamp" in context:
            context = {k: v for k, v in context.items() if k != "timestamp"}
        return context

# Create singleton instance
search_service = SearchService()