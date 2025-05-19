import logging
import datetime
import json
import os
import asyncio
import time
from typing import Dict, Any, Optional, List
import hashlib
from app.core.vector_store import vector_store
from app.core.config import settings


logger = logging.getLogger(__name__)


class FeedbackManager:
    def __init__(self):
        self.feedback_dir = os.path.join(
            os.path.dirname(__file__), "../../data/feedback")
        self.high_quality_examples = []
        self.feedback_threshold = settings.FEEDBACK_QUALITY_THRESHOLD
        self.last_analysis_time = None
        self.analysis_interval = settings.FEEDBACK_ANALYSIS_INTERVAL
        self.version_cleanup_interval = settings.FEEDBACK_CLEANUP_INTERVAL
        self.max_feedback_files = settings.FEEDBACK_MAX_FILES
        self.max_files_per_dir = 1000   # Maximum files per directory
        self.feedback_cache = {}        # In-memory cache
        self.cache_ttl = settings.FEEDBACK_CACHE_TTL

    def initialize(self):
        """Initialize the feedback system with partitioning"""
        os.makedirs(self.feedback_dir, exist_ok=True)

        # Create partitioned directories
        for i in range(10):  # 10 partitions based on hash
            partition_dir = os.path.join(self.feedback_dir, str(i))
            os.makedirs(partition_dir, exist_ok=True)

        logger.info(
            f"Feedback manager initialized. Storage path: {self.feedback_dir}")

        # Schedule background tasks
        asyncio.create_task(self._periodic_feedback_analysis())
        asyncio.create_task(self._periodic_feedback_cleanup())
        asyncio.create_task(self._periodic_cache_cleanup())
        return True

    async def store_feedback(self,
                             product: str,
                             description: str,
                             rating: int,
                             user_id: str = "anonymous",
                             comment: Optional[str] = None,
                             user_edited_description: Optional[str] = None) -> bool:
        """Store feedback about a generated description using partitioning"""
        try:
            # Generate a unique ID for this feedback
            feedback_id = hashlib.md5(
                f"{product}:{description}:{user_id}:{datetime.datetime.now().isoformat()}".encode()).hexdigest()

            # Create feedback object
            feedback_data = {
                "id": feedback_id,
                "product": product,
                "description": description,
                "rating": rating,
                "user_id": user_id,
                "timestamp": datetime.datetime.now().isoformat(),
                "comment": comment,
                "user_edited_description": user_edited_description
            }

            # Determine partition based on hash of product name
            partition = int(hashlib.md5(
                product.lower().encode()).hexdigest()[0], 16) % 10
            partition_dir = os.path.join(self.feedback_dir, str(partition))

            # Write to feedback file
            filename = os.path.join(partition_dir, f"{feedback_id}.json")
            with open(filename, 'w') as f:
                json.dump(feedback_data, f, indent=2)

            # Add to in-memory cache
            product_key = product.lower().strip()
            if product_key not in self.feedback_cache:
                self.feedback_cache[product_key] = {
                    'timestamp': time.time(),
                    'items': []
                }
            self.feedback_cache[product_key]['items'].append(feedback_data)

            logger.info(
                f"Stored feedback for product '{product}' with rating {rating}")

            # If this is a high-quality feedback with user edits, add to vector store immediately
            if rating >= self.feedback_threshold and user_edited_description:
                product_id = f"{hashlib.md5(product.lower().strip().encode()).hexdigest()}_edited"
                await vector_store.add_description(
                    product_id=product_id,
                    product=product,
                    description=user_edited_description,
                    context={"queries": [
                        f"User edited {product}", f"High quality {product}"]},
                    metadata={
                        "timestamp": datetime.datetime.now().isoformat(),
                        "rating": rating,
                        "is_user_edited": True
                    }
                )
                logger.info(
                    f"Added user-edited high-quality description to vector store for '{product}'")

            return True
        except Exception as e:
            logger.error(f"Error storing feedback: {str(e)}")
            return False

    async def get_product_feedback(self, product: str) -> List[Dict[str, Any]]:
        """Get all feedback for a specific product with caching"""
        product_key = product.lower().strip()

        # Check cache first
        if product_key in self.feedback_cache:
            cache_entry = self.feedback_cache[product_key]
            if time.time() - cache_entry['timestamp'] < self.cache_ttl:
                return cache_entry['items']

        # If not in cache, load from disk
        try:
            # Determine partition based on hash
            partition = int(hashlib.md5(
                product_key.encode()).hexdigest()[0], 16) % 10
            partition_dir = os.path.join(self.feedback_dir, str(partition))

            if not os.path.exists(partition_dir):
                return []

            feedback_files = [f for f in os.listdir(
                partition_dir) if f.endswith('.json')]
            product_feedback = []

            for filename in feedback_files:
                try:
                    with open(os.path.join(partition_dir, filename), 'r') as f:
                        feedback = json.load(f)
                        if feedback.get('product', '').lower().strip() == product_key:
                            product_feedback.append(feedback)
                except Exception as e:
                    logger.error(
                        f"Error loading feedback file {filename}: {str(e)}")

            # Update cache
            self.feedback_cache[product_key] = {
                'timestamp': time.time(),
                'items': product_feedback
            }

            return product_feedback
        except Exception as e:
            logger.error(f"Error retrieving product feedback: {str(e)}")
            return []

    async def _periodic_cache_cleanup(self):
        """Clean up the in-memory cache periodically"""
        while True:
            try:
                # Clean up every TTL period
                await asyncio.sleep(self.cache_ttl)
                current_time = time.time()

                # Find expired entries
                expired_keys = []
                for key, cache_entry in self.feedback_cache.items():
                    if current_time - cache_entry['timestamp'] >= self.cache_ttl:
                        expired_keys.append(key)

                # Remove expired entries
                for key in expired_keys:
                    del self.feedback_cache[key]

                if expired_keys:
                    logger.debug(
                        f"Cleaned up {len(expired_keys)} expired cache entries")
            except Exception as e:
                logger.error(f"Error in cache cleanup: {str(e)}")
                await asyncio.sleep(300)  # Wait 5 minutes before retrying

    async def analyze_feedback(self):
        """Analyze collected feedback to find patterns and high-quality examples"""
        logger.info("Starting feedback analysis")
        try:
            # Instead of loading all files at once, process by partition
            high_quality = []

            for partition in range(10):
                partition_dir = os.path.join(self.feedback_dir, str(partition))
                feedback_files = [f for f in os.listdir(partition_dir) if f.endswith(
                    '.json')] if os.path.exists(partition_dir) else []

                # Process files in batches to avoid memory spikes
                batch_size = 100
                for i in range(0, len(feedback_files), batch_size):
                    batch_files = feedback_files[i:i+batch_size]

                    # Process batch
                    for filename in batch_files:
                        try:
                            with open(os.path.join(partition_dir, filename), 'r') as f:
                                feedback = json.load(f)
                                if feedback.get('rating', 0) >= self.feedback_threshold:
                                    high_quality.append(feedback)
                        except Exception as e:
                            logger.error(
                                f"Error loading feedback file {filename}: {str(e)}")

                    # Give some time back to the event loop
                    await asyncio.sleep(0.1)

            # Group high quality feedback by product
            product_groups = {}
            for feedback in high_quality:
                product = feedback.get('product', '').lower().strip()
                if product:
                    if product not in product_groups:
                        product_groups[product] = []
                    product_groups[product].append(feedback)

            # Process each product group
            for product, feedbacks in product_groups.items():
                if len(feedbacks) >= 2:
                    # Sort by rating
                    feedbacks.sort(key=lambda x: x.get(
                        'rating', 0), reverse=True)

                    # Get the best description (user-edited preferred)
                    best_feedback = next((f for f in feedbacks if f.get(
                        'user_edited_description')), feedbacks[0])

                    # Use the user-edited version if available, otherwise use the original
                    best_description = best_feedback.get(
                        'user_edited_description') or best_feedback.get('description')

                    if best_description:
                        # Add as a high-quality example to vector store with special tag
                        product_id = f"{hashlib.md5(product.encode()).hexdigest()}_highquality"
                        await vector_store.add_description(
                            product_id=product_id,
                            product=product,
                            description=best_description,
                            context={"queries": [
                                f"Best {product} description", f"Verified {product}"]},
                            metadata={
                                "timestamp": datetime.datetime.now().isoformat(),
                                "verified": True,
                                "avg_rating": sum(f.get('rating', 0) for f in feedbacks) / len(feedbacks)
                            }
                        )
                        logger.info(
                            f"Added verified high-quality description for '{product}' from feedback analysis")

            self.last_analysis_time = datetime.datetime.now()
            logger.info(
                f"Feedback analysis complete. Processed {len(high_quality)} high-quality feedback items.")

        except Exception as e:
            logger.error(f"Error analyzing feedback: {str(e)}")

    async def _periodic_feedback_analysis(self):
        """Background task to periodically analyze feedback"""
        while True:
            try:
                await asyncio.sleep(self.analysis_interval)
                await self.analyze_feedback()
            except Exception as e:
                logger.error(f"Error in feedback analysis: {str(e)}")
                await asyncio.sleep(3600)  # Wait an hour before retrying

    async def _periodic_feedback_cleanup(self):
        """Background task to clean up old feedback files"""
        while True:
            try:
                await asyncio.sleep(self.version_cleanup_interval)
                await self._cleanup_old_feedback()
            except Exception as e:
                logger.error(f"Error in feedback cleanup: {str(e)}")
                await asyncio.sleep(3600)  # Wait an hour before retrying

    async def _cleanup_old_feedback(self):
        """Clean up old feedback files when we exceed storage limits"""
        logger.info("Starting feedback cleanup")
        try:
            total_count = 0

            # Check each partition
            for partition in range(10):
                partition_dir = os.path.join(self.feedback_dir, str(partition))
                if not os.path.exists(partition_dir):
                    continue

                # Get all feedback files and their modification times
                feedback_files = []
                for filename in os.listdir(partition_dir):
                    if filename.endswith('.json'):
                        file_path = os.path.join(partition_dir, filename)
                        mod_time = os.path.getmtime(file_path)
                        feedback_files.append((file_path, mod_time))

                total_count += len(feedback_files)

                # If this partition has too many files, delete the oldest ones
                if len(feedback_files) > self.max_files_per_dir:
                    # Sort by modification time (oldest first)
                    feedback_files.sort(key=lambda x: x[1])

                    # Delete the oldest files
                    files_to_delete = feedback_files[:-self.max_files_per_dir]
                    for file_path, _ in files_to_delete:
                        try:
                            os.remove(file_path)
                            logger.debug(
                                f"Deleted old feedback file: {file_path}")
                        except Exception as e:
                            logger.error(
                                f"Failed to delete file {file_path}: {str(e)}")

            # If total count is still too high, do a more aggressive cleanup
            if total_count > self.max_feedback_files:
                logger.warning(
                    f"Total feedback files ({total_count}) exceeds maximum ({self.max_feedback_files})")

                # Get all files across all partitions
                all_files = []
                for partition in range(10):
                    partition_dir = os.path.join(
                        self.feedback_dir, str(partition))
                    if os.path.exists(partition_dir):
                        for filename in os.listdir(partition_dir):
                            if filename.endswith('.json'):
                                file_path = os.path.join(
                                    partition_dir, filename)
                                mod_time = os.path.getmtime(file_path)
                                all_files.append((file_path, mod_time))

                # Sort by modification time (oldest first)
                all_files.sort(key=lambda x: x[1])

                # Delete the oldest files to get back under the limit
                files_to_delete = all_files[:len(
                    all_files) - self.max_feedback_files]
                for file_path, _ in files_to_delete:
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass

                logger.info(
                    f"Deleted {len(files_to_delete)} old feedback files during aggressive cleanup")

            # Clear the cache after cleanup
            self.feedback_cache = {}
            logger.info(
                f"Feedback cleanup complete. Current file count: {total_count}")

        except Exception as e:
            logger.error(f"Error cleaning up old feedback: {str(e)}")


# Create singleton instance
feedback_manager = FeedbackManager()
