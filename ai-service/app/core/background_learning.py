import logging
import asyncio
import datetime
import os
import aiosqlite
from typing import List
from app.core.config import settings  # Import settings module

logger = logging.getLogger(__name__)


class BackgroundLearner:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(
            __file__), "../../data/background_learning.db")
        # Use value from settings
        self.learning_interval = settings.BACKGROUND_LEARNING_INTERVAL
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

        # Schedule background task - we'll initialize the DB in the task
        asyncio.create_task(self._initialize_db())
        
        logger.info("Background learner initialized")
        return True

    async def _initialize_db(self):
        """Initialize the database asynchronously"""
        try:
            # Initialize SQLite database
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.cursor()
                await cursor.execute('''
                    CREATE TABLE IF NOT EXISTS products (
                        product TEXT PRIMARY KEY,
                        last_updated TEXT,
                        generation_count INTEGER DEFAULT 1,
                        added_timestamp TEXT
                    )
                ''')
                await conn.commit()
            
            logger.info("Background learner database initialized")
            
            # Start the periodic learning task
            asyncio.create_task(self._periodic_learning())
        except Exception as e:
            logger.error(f"Error initializing background learner database: {str(e)}")

    async def add_popular_product(self, product: str) -> bool:
        """Add a product to the popular products database"""
        try:
            if not product:
                return False

            # Connect to DB
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.cursor()

                # Check if product already exists
                now = datetime.datetime.now().isoformat()
                await cursor.execute(
                    "SELECT product, generation_count FROM products WHERE product = ?", (product.lower().strip(),))
                result = await cursor.fetchone()

                if result:
                    # Update existing product record
                    await cursor.execute(
                        "UPDATE products SET generation_count = generation_count + 1, last_updated = ? WHERE product = ?",
                        (now, product.lower().strip())
                    )
                else:
                    # Insert new product
                    await cursor.execute(
                        "INSERT INTO products (product, last_updated, generation_count, added_timestamp) VALUES (?, ?, 1, ?)",
                        (product.lower().strip(), now, now)
                    )

                await conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error adding popular product: {str(e)}")
            return False

    async def _get_products_needing_update(self, limit: int = 5) -> List[str]:
        """Get products that need updates based on various criteria"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.cursor()

                # Query products not updated in the last 7 days, ordered by popularity
                seven_days_ago = (datetime.datetime.now() -
                                  datetime.timedelta(days=7)).isoformat()

                await cursor.execute("""
                    SELECT product FROM products 
                    WHERE last_updated < ? 
                    ORDER BY generation_count DESC
                    LIMIT ?
                """, (seven_days_ago, limit))

                rows = await cursor.fetchall()
                result = [row[0] for row in rows]
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
                logger.warning(
                    "Cannot perform learning cycle: generate_description function not set")
                return

            # Get products needing updates
            products_to_process = await self._get_products_needing_update(limit=self.batch_size)

            if not products_to_process:
                logger.info("No products need refreshing")
                return

            logger.info(
                f"Learning cycle will process {len(products_to_process)} products")

            # Process each product in the batch
            for product in products_to_process:
                try:
                    # Generate a new description to update the vector database
                    description = await self.generate_description_func(product, force_refresh=True)
                    logger.info(f"Background learner refreshed: '{product}'")

                    # Update last_updated timestamp
                    async with aiosqlite.connect(self.db_path) as conn:
                        cursor = await conn.cursor()
                        await cursor.execute(
                            "UPDATE products SET last_updated = ? WHERE product = ?",
                            (datetime.datetime.now().isoformat(), product)
                        )
                        await conn.commit()
                except Exception as e:
                    logger.error(
                        f"Error learning product '{product}': {str(e)}")

                # Small delay between products to avoid overloading
                await asyncio.sleep(5)

            logger.info(
                f"Learning cycle completed for {len(products_to_process)} products")

        except Exception as e:
            logger.error(f"Error in learning cycle: {str(e)}")

    async def pregenerate_trending_products(self):
        """Pregenerate descriptions for trending products during off-peak hours"""
        try:
            # Get top 20 most requested products from the last week
            conn = aiosqlite.connect(self.db_path)
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.cursor()

                one_week_ago = (datetime.datetime.now() -
                                datetime.timedelta(days=7)).isoformat()
                await cursor.execute("""
                    SELECT product FROM products 
                    WHERE last_updated < ? 
                    ORDER BY generation_count DESC
                    LIMIT 20
                """, (one_week_ago,))

                trending_products = [row[0] for row in await cursor.fetchall()]
            # Generate descriptions in the background
            for product in trending_products:
                try:
                    if self.generate_description_func is not None:
                        await self.generate_description_func(product, force_refresh=True)
                        logger.info(
                            f"Pregenerated description for trending product: {product}")
                    else:
                        logger.warning("generate_description_func is not set, skipping product pregeneration.")
                    await asyncio.sleep(30)  # Space out generations
                except Exception as e:
                    logger.error(
                        f"Error pregenerating for {product}: {str(e)}")

        except Exception as e:
            logger.error(f"Error in pregenerate_trending_products: {str(e)}")


# Create singleton instance
background_learner = BackgroundLearner()
