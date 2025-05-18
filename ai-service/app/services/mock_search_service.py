import logging
from typing import Dict, Any
import datetime

logger = logging.getLogger(__name__)

class MockSearchService:
    def __init__(self):
        self.mock_contexts = {
            "rice": [
                "Best Basmati Rice Brands in Bangladesh",
                "How to cook perfect rice every time",
                "Wholesale rice prices in Dhaka",
                "Premium long grain rice features",
                "Rice varieties comparison Bangladesh"
            ],
            "milk": [
                "Fresh milk benefits and nutrition facts",
                "Popular milk brands in Bangladesh",
                "Long shelf life UHT milk features",
                "Milk pasteurization process explained",
                "Organic milk vs regular milk comparison"
            ],
            "bread": [
                "Whole grain bread benefits",
                "Fresh bread suppliers in Dhaka",
                "Best bread brands in Bangladesh",
                "Bread making ingredients",
                "Artisan bread varieties"
            ],
            "phone": [
                "Latest smartphone features 2025",
                "Budget phones in Bangladesh",
                "Best camera phones",
                "Android vs iOS comparison",
                "Smartphone battery life rankings"
            ],
            "laptop": [
                "Best laptops for students",
                "Business laptops in Bangladesh",
                "Gaming laptop specifications",
                "Laptop prices in Dhaka",
                "MacBook vs Windows laptops"
            ],
        }
        
    def connect(self):
        """No connection needed for mock service"""
        logger.info("Mock search service initialized")
        return True
            
    async def get_search_context(self, product: str, limit: int = 5) -> Dict[str, Any]:
        """Get mock search context for a product"""
        # Try to find exact match first
        product_lower = product.lower()
        queries = self.mock_contexts.get(product_lower, [])
        
        # If no exact match, try to find partial matches
        if not queries:
            for key in self.mock_contexts:
                if key in product_lower or product_lower in key:
                    queries = self.mock_contexts[key]
                    break
                    
        # If still no match, generate generic queries
        if not queries:
            queries = [
                f"Best {product} brands in Bangladesh",
                f"{product} features and benefits",
                f"How to choose quality {product}",
                f"{product} price comparison Bangladesh",
                f"Popular {product} types in market"
            ]
            
        return {
            "queries": queries[:limit],
            "timestamp": datetime.datetime.now().isoformat()
        }

# Create singleton instance
mock_search_service = MockSearchService()