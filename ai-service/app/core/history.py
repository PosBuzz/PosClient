import logging
import datetime
import json
import os
import asyncio
from typing import Dict, Any, List, Optional
import hashlib
import sqlite3
from app.core.config import settings  # Change this line

logger = logging.getLogger(__name__)

class HistoryManager:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(__file__), "../../data/history.db")
        self.version_cleanup_interval = settings.HISTORY_CLEANUP_INTERVAL
        self.versions_to_keep = settings.HISTORY_VERSIONS_TO_KEEP
        self.latest_versions_cache = {}
        self.cache_ttl = settings.VECTOR_STORE_CACHE_TTL  # Use value from settings for consistency
        
    def initialize(self):
        """Initialize the history system with SQLite for better scalability"""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            # Create SQLite database for version history
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS versions (
                    id TEXT PRIMARY KEY,
                    product TEXT,
                    description TEXT,
                    context TEXT,
                    version_id TEXT,
                    timestamp TEXT,
                    UNIQUE(product, version_id)
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_versions_product ON versions (product)
            ''')
            
            conn.commit()
            conn.close()
            
            logger.info(f"History manager initialized with SQLite at {self.db_path}")
            
            # Schedule background task
            asyncio.create_task(self._periodic_version_cleanup())
            return True
        except Exception as e:
            logger.error(f"Error initializing history manager: {str(e)}")
            return False
        
    async def store_version(self, 
                           product: str, 
                           description: str, 
                           context: Dict[str, Any]) -> Optional[str]:
        """Store a new version of a product description in SQLite"""
        try:
            if not product:
                return None
                
            # Generate stable product ID
            product_key = product.lower().strip()
            
            # Generate version ID based on timestamp
            version_id = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
            
            # Store serialized context
            context_json = json.dumps(context) if context else "{}"
            
            # Create record ID
            record_id = f"{hashlib.md5(f'{product_key}:{version_id}'.encode()).hexdigest()}"
            
            # Store in database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO versions (id, product, description, context, version_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    record_id, 
                    product_key, 
                    description, 
                    context_json, 
                    version_id, 
                    datetime.datetime.now().isoformat()
                )
            )
            conn.commit()
            conn.close()
            
            # Invalidate cache
            if product_key in self.latest_versions_cache:
                del self.latest_versions_cache[product_key]
            
            logger.info(f"Stored version {version_id} for product '{product}'")
            return version_id
            
        except Exception as e:
            logger.error(f"Error storing version: {str(e)}")
            return None
            
    async def get_version_history(self, product: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get versions of a product description from SQLite"""
        try:
            if not product:
                return []
                
            product_key = product.lower().strip()
            
            # Query database
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # This enables column access by name
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT * FROM versions WHERE product = ? ORDER BY timestamp DESC LIMIT ?", 
                (product_key, limit)
            )
            
            rows = cursor.fetchall()
            conn.close()
            
            # Format results
            versions = []
            for row in rows:
                try:
                    context = json.loads(row['context']) if row['context'] else {}
                    versions.append({
                        "product": row['product'],
                        "description": row['description'],
                        "context": context,
                        "version_id": row['version_id'],
                        "timestamp": row['timestamp']
                    })
                except Exception as e:
                    logger.error(f"Error parsing version row: {str(e)}")
            
            return versions
            
        except Exception as e:
            logger.error(f"Error getting version history: {str(e)}")
            return []
            
    async def get_latest_version(self, product: str) -> Optional[Dict[str, Any]]:
        """Get the latest version of a product description with caching"""
        if not product:
            return None
            
        product_key = product.lower().strip()
        
        # Check cache first
        if product_key in self.latest_versions_cache:
            cache_entry = self.latest_versions_cache[product_key]
            if (datetime.datetime.now() - datetime.datetime.fromisoformat(cache_entry['cache_time'])).total_seconds() < self.cache_ttl:
                return cache_entry['version']
        
        # Get from database
        versions = await self.get_version_history(product, limit=1)
        if versions:
            # Store in cache
            self.latest_versions_cache[product_key] = {
                'version': versions[0],
                'cache_time': datetime.datetime.now().isoformat()
            }
            return versions[0]
        
        return None
            
    async def _periodic_version_cleanup(self):
        """Background task to clean up old versions"""
        while True:
            try:
                await asyncio.sleep(self.version_cleanup_interval)
                await self._cleanup_old_versions()
            except Exception as e:
                logger.error(f"Error in version cleanup: {str(e)}")
                await asyncio.sleep(3600)  # Wait an hour before retrying
            
    async def _cleanup_old_versions(self):
        """Clean up old versions, keeping only the latest 3 per product"""
        logger.info("Starting version history cleanup")
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get distinct products
            cursor.execute("SELECT DISTINCT product FROM versions")
            products = [row[0] for row in cursor.fetchall()]
            
            total_deleted = 0
            
            # For each product, keep only the latest 3 versions
            for product in products:
                try:
                    # Get all versions for this product
                    cursor.execute(
                        "SELECT id FROM versions WHERE product = ? ORDER BY timestamp DESC",
                        (product,)
                    )
                    versions = [row[0] for row in cursor.fetchall()]
                    
                    # If we have more than the configured number to keep, delete the oldest ones
                    if len(versions) > self.versions_to_keep:
                        versions_to_keep = versions[:self.versions_to_keep]
                        placeholders = ', '.join(['?' for _ in versions_to_keep])
                        
                        cursor.execute(
                            f"DELETE FROM versions WHERE product = ? AND id NOT IN ({placeholders})",
                            [product] + versions_to_keep
                        )
                        
                        deleted_count = cursor.rowcount
                        total_deleted += deleted_count
                        
                        logger.debug(f"Deleted {deleted_count} old versions for product '{product}'")
                except Exception as e:
                    logger.error(f"Error cleaning up versions for product {product}: {str(e)}")
            
            conn.commit()
            conn.close()
            
            # Clear cache after cleanup
            self.latest_versions_cache = {}
            
            logger.info(f"Version history cleanup complete. Deleted {total_deleted} old versions.")
            
        except Exception as e:
            logger.error(f"Error cleaning up old versions: {str(e)}")

# Create singleton instance
history_manager = HistoryManager()