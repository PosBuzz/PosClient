import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

class ServiceFactory:
    """Factory to provide the appropriate search service based on configuration"""
    
    @staticmethod
    def get_search_service() -> Any:
        """
        Returns the configured search service based on environment variables
        
        The order of preference is:
        1. Google Custom Search if API keys are set
        2. DuckDuckGo if SEARCH_ENGINE=duckduckgo (or if not specified)
        3. Mock data if SEARCH_ENGINE=mock
        """
        search_engine = os.getenv("SEARCH_ENGINE", "duckduckgo").lower()
        
        if search_engine == "google" and os.getenv("GOOGLE_SEARCH_API_KEY") and os.getenv("GOOGLE_SEARCH_CX"):
            # Import here to avoid circular imports
            from app.services.google_search_service import google_search_service
            logger.info("Using Google Custom Search service")
            return google_search_service
        elif search_engine == "mock":
            # Import here to avoid circular imports
            from app.services.mock_search_service import mock_search_service
            logger.info("Using mock search service")
            return mock_search_service
        else:
            # Default to DuckDuckGo
            from app.services.duckduckgo_service import duckduckgo_service
            logger.info("Using DuckDuckGo search service")
            return duckduckgo_service

# Export the selected service
search_service = ServiceFactory.get_search_service()