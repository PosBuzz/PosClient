import logging
import requests
import os
from typing import Dict, Any, List
import datetime

logger = logging.getLogger(__name__)

class GoogleSearchService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_SEARCH_API_KEY", "")
        self.cx = os.getenv("GOOGLE_SEARCH_CX", "")  # Custom Search Engine ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"
        
    def connect(self):
        """Check if API keys are set"""
        if not self.api_key or not self.cx:
            logger.warning("Google Search API credentials missing")
            return False
        else:
            logger.info("Google Search service initialized")
            return True
            
    async def get_search_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Get search context related to a product via Google Custom Search"""
        if not self.api_key or not self.cx:
            logger.error("Cannot use Google Search: API credentials missing")
            return {"queries": [], "timestamp": datetime.datetime.now().isoformat()}
            
        try:
            # Search parameters
            params = {
                "key": self.api_key,
                "cx": self.cx,
                "q": f"{product} features bangladesh",
                "num": limit
            }
            
            response = requests.get(self.base_url, params=params)
            data = response.json()
            
            queries = []
            if "items" in data:
                for item in data["items"]:
                    if "title" in item:
                        # Clean up the title to use as search context
                        title = item["title"].replace(" - ", " ").replace(" | ", " ")
                        queries.append(title)
            
            return {
                "queries": queries[:limit],
                "timestamp": datetime.datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error fetching Google search data: {e}")
            return {"queries": [], "timestamp": datetime.datetime.now().isoformat()}

# Create singleton instance
google_search_service = GoogleSearchService()