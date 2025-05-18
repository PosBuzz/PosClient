import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

class ServiceFactory:
    """Factory to provide the appropriate search service based on configuration"""
    
    @staticmethod
    def get_search_service() -> Any:
        """Returns configured search service based on environment variables"""
        search_engine = os.getenv("SEARCH_ENGINE", "duckduckgo").lower()
        
        if search_engine == "mock":
            from app.services.mock_search_service import mock_search_service
            return mock_search_service
        elif search_engine == "google" and os.getenv("GOOGLE_SEARCH_API_KEY") and os.getenv("GOOGLE_SEARCH_CX"):
            from app.services.google_search_service import google_search_service
            return google_search_service
        else:
            from app.services.duckduckgo_service import duckduckgo_service
            return duckduckgo_service

# Export the selected service
search_service = ServiceFactory.get_search_service()