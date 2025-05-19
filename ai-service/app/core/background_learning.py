import logging
import asyncio
import datetime
import os
import sqlite3
from typing import List
from app.core.config import settings  # Import settings module

logger = logging.getLogger(__name__)

class BackgroundLearner:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(__file__), "../../data/background_learning.db")
        self.learning_interval = settings.BACKGROUND_LEARNING_INTERVAL  # Use value from settings
        self.batch_size = settings.MAX_BACKGROUND_BATCH_SIZE  # Use value from settings
        self.generate_description_func = None  # Will be set later
        self.conn = None
        
    def initialize(self, generate_description_func=None):
        """Initialize the background learner with SQLite DB instead of JSON files"""
        # Create data directory if needed
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        # Set the generate_description function reference
        if generate_description_func:
            self.generate_description_func = generate_description_func
        
        # Initialize SQLite database
        try:
            self.conn = sqlite3.connect(self.db_path)
            cursor = self.conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS products (
                    product TEXT PRIMARY KEY,
                    last_updated TEXT,
                    generation_count INTEGER DEFAULT 1,
                    added_timestamp TEXT
                )
            ''')
            self.conn.commit()
            logger.info("Background learner database initialized")
            
            # Close connection - we'll reopen as needed
            self.conn.close()
            self.conn = None
        except Exception as e:
            logger.error(f"Error initializing background learner database: {str(e)}")
        
        # Schedule background task
        asyncio.create_task(self._periodic_learning())
        logger.info("Background learner initialized")
        return True
        
    async def add_popular_product(self, product: str) -> bool:
        """Add a product to the popular products database"""
        try:
            if not product:
                return False
                
            # Connect to DB
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Check if product already exists
            now = datetime.datetime.now().isoformat()
            cursor.execute("SELECT product, generation_count FROM products WHERE product = ?", (product.lower().strip(),))
            result = cursor.fetchone()
            
            if result:
                # Update existing product record
                cursor.execute(
                    "UPDATE products SET generation_count = generation_count + 1, last_updated = ? WHERE product = ?",
                    (now, product.lower().strip())
                )
            else:
                # Insert new product
                cursor.execute(
                    "INSERT INTO products (product, last_updated, generation_count, added_timestamp) VALUES (?, ?, 1, ?)",
                    (product.lower().strip(), now, now)
                )
                
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error adding popular product: {str(e)}")
            return False
            
    async def _get_products_needing_update(self, limit: int = 5) -> List[str]:
        """Get products that need updates based on various criteria"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Query products not updated in the last 7 days, ordered by popularity
            seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).isoformat()
            
            cursor.execute("""
                SELECT product FROM products 
                WHERE last_updated < ? 
                ORDER BY generation_count DESC
                LIMIT ?
            """, (seven_days_ago, limit))
            
            result = [row[0] for row in cursor.fetchall()]
            conn.close()
            return result
        except Exception as e:
            logger.error(f"Error getting products for update: {str(e)}")
            return []
            
    async def _periodic_learning(self):
        """Background task to periodically learn from popular products"""
        # Wait a bit after startup
        await asyncio.sleep(300)  # 5 minutes after startup
        
        while True:
            try:
                await self._perform_learning_cycle()
                await asyncio.sleep(self.learning_interval)
            except Exception as e:
                logger.error(f"Error in background learning: {str(e)}")
                await asyncio.sleep(3600)  # Wait an hour before retrying
                
    async def _perform_learning_cycle(self):
        """Perform one learning cycle with optimized product selection"""
        logger.info("Starting background learning cycle")
        try:
            # Skip if the generate_description function isn't set
            if not self.generate_description_func:
                logger.warning("Cannot perform learning cycle: generate_description function not set")
                return
                
            # Get products needing updates
            products_to_process = await self._get_products_needing_update(limit=self.batch_size)
            
            if not products_to_process:
                logger.info("No products need refreshing")
                return
                
            logger.info(f"Learning cycle will process {len(products_to_process)} products")
            
            # Process each product in the batch
            for product in products_to_process:
                try:
                    # Generate a new description to update the vector database
                    description = await self.generate_description_func(product, force_refresh=True)
                    logger.info(f"Background learner refreshed: '{product}'")
                    
                    # Update last_updated timestamp
                    conn = sqlite3.connect(self.db_path)
                    cursor = conn.cursor()
                    cursor.execute(
                        "UPDATE products SET last_updated = ? WHERE product = ?",
                        (datetime.datetime.now().isoformat(), product)
                    )
                    conn.commit()
                    conn.close()
                except Exception as e:
                    logger.error(f"Error learning product '{product}': {str(e)}")
                
                # Small delay between products to avoid overloading
                await asyncio.sleep(5)
                
            logger.info(f"Learning cycle completed for {len(products_to_process)} products")
            
        except Exception as e:
            logger.error(f"Error in learning cycle: {str(e)}")

# Create singleton instance
background_learner = BackgroundLearner()