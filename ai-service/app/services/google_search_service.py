import logging
from typing import Dict, Any, List
import datetime
import requests
import json
import time
import os

logger = logging.getLogger(__name__)

class GoogleSearchService:
    def __init__(self):
        self.api_key = None
        self.cx = None
        # Simple in-memory cache for search results
        self.search_cache = {}
        self.cache_ttl = 3600  # 1 hour in seconds
        
    def connect(self):
        """Load the API key and CX from environment variables"""
        self.api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.cx = os.getenv("GOOGLE_SEARCH_CX")
        
        if not self.api_key or not self.cx:
            logger.error("Google Search API key or CX not configured properly")
            return False
            
        logger.info("Google Search service initialized")
        return True
            
    async def get_search_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Get search context related to a product via Google Search API"""
        # Generate cache key for this search
        product_key = product.lower()
        
        # Check cache first
        if product_key in self.search_cache:
            cache_entry = self.search_cache[product_key]
            # Check if cache is still valid
            if (time.time() - cache_entry['timestamp']) < self.cache_ttl:
                logger.info(f"Using cached Google search results for '{product}'")
                return cache_entry['context']
        
        if not self.api_key or not self.cx:
            logger.error("Google Search API key or CX not configured")
            return {"queries": [], "timestamp": datetime.datetime.now().isoformat()}
        
        try:
            # Format the query to be more POS-relevant
            query = f"{product} features details bangladesh"
            
            # Call Google Custom Search API
            url = "https://www.googleapis.com/customsearch/v1"
            params = {
                "key": self.api_key,
                "cx": self.cx,
                "q": query,
                "num": limit  # Request 'limit' results
            }
            
            response = requests.get(url, params=params)
            
            if response.status_code != 200:
                logger.error(f"Google Search API error: {response.status_code}, {response.text}")
                return {"queries": [], "timestamp": datetime.datetime.now().isoformat()}
                
            data = response.json()
            
            # Extract information from all results
            queries = []
            
            # Process each item in results
            if "items" in data:
                for item in data["items"]:
                    # Add title
                    if "title" in item:
                        queries.append(item["title"])
                    
                    # Add snippet if available
                    if "snippet" in item:
                        # Split snippet into sentences and take the first one
                        sentence = item["snippet"].split('.')[0]
                        if sentence and len(sentence) > 20:  # Only if it's a meaningful sentence
                            queries.append(sentence)
            
            # Process top ranking keywords from search
            if "queries" in data and "request" in data["queries"]:
                if data["queries"]["request"] and len(data["queries"]["request"]) > 0:
                    for term in data["queries"]["request"][0].get("inputTerms", []):
                        if term:
                            queries.append(term)
            
            # Get unique queries
            unique_queries = []
            for q in queries:
                q_clean = q.strip()
                if q_clean and q_clean not in unique_queries:
                    unique_queries.append(q_clean)
            
            # Limit to the specified number
            unique_queries = unique_queries[:limit]
            
            # Create context object
            context = {
                "queries": unique_queries,
                "timestamp": datetime.datetime.now().isoformat()
            }
            
            # Cache the results
            self.search_cache[product_key] = {
                'context': context,
                'timestamp': time.time()
            }
            
            return context
        except Exception as e:
            logger.error(f"Error fetching Google search data: {str(e)}")
            return {"queries": [], "timestamp": datetime.datetime.now().isoformat()}

# Create singleton instance
google_search_service = GoogleSearchService()