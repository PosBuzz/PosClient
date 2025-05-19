import logging
from typing import List, Dict, Any, Optional
import os
from functools import lru_cache
import time
from app.core.config import settings
import chromadb
from chromadb.config import Settings as ChromaSettings
import numpy as np

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self):
        self.client = None
        self.collections = {}  # Multiple collections for partitioning
        self.persist_directory = os.path.abspath(settings.CHROMA_DB_DIR)
        self.similarity_cache = {}  # In-memory cache for similarity results
        self.cache_ttl = settings.VECTOR_STORE_CACHE_TTL  # Use value from settings
        self.use_sharding = settings.CHROMA_COLLECTION_SHARDING  # Use value from settings
        
    def connect(self):
        """Initialize ChromaDB connection with optimized settings"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(self.persist_directory, exist_ok=True)

            logger.info(f"Connecting to ChromaDB at {self.persist_directory}")
            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(
                    anonymized_telemetry=settings.CHROMA_TELEMETRY
                )
            )

            # Default collection is still created for backwards compatibility
            self.collections["main"] = self.client.get_or_create_collection(
                name="product_descriptions",
                metadata={
                    "hnsw:space": "cosine",
                    "hnsw:construction_ef": 128,  # Higher values = better recall at indexing time
                    "hnsw:search_ef": 100,        # Higher values = better recall at query time
                    "hnsw:M": 64                  # Higher values = better recall at cost of memory
                }
            )

            logger.info(f"✅ Successfully connected to ChromaDB")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB: {str(e)}")
            return False

    def _get_collection_for_product(self, product: str):
        """Get appropriate collection by partitioning strategy"""
        # Simple first-letter partitioning
        if not product:
            return self.collections["main"]
            
        first_char = product[0].lower() if product else 'a'
        # Group by first letter into 5 collections (a-e, f-j, k-o, p-t, u-z)
        ranges = {
            "a_e": "abcde", 
            "f_j": "fghij",
            "k_o": "klmno", 
            "p_t": "pqrst", 
            "u_z": "uvwxyz"
        }
        
        collection_key = "main"  # Default
        for key, char_range in ranges.items():
            if first_char in char_range:
                collection_key = key
                break
                
        # Create collection if doesn't exist yet
        if collection_key not in self.collections:
            try:
                self.collections[collection_key] = self.client.get_or_create_collection(
                    name=f"products_{collection_key}",
                    metadata={
                        "hnsw:space": "cosine",
                        "hnsw:construction_ef": 128,
                        "hnsw:search_ef": 100,
                        "hnsw:M": 64
                    }
                )
            except Exception as e:
                logger.error(f"Failed to create collection {collection_key}: {str(e)}")
                return self.collections["main"]  # Fallback to main
                
        return self.collections[collection_key]

    async def add_description(self,
                              product_id: str,
                              product: str,
                              description: str,
                              context: Dict[str, Any],
                              metadata: Optional[Dict[str, Any]] = None):
        """Add product description to vector store using partitioning"""
        if not self.client:
            if not self.connect():
                logger.error("Failed to connect to vector store")
                return False

        try:
            # Prepare document and metadata
            document = f"Product: {product}\nDescription: {description}"

            # Build metadata including context
            meta = {
                "product": product,
                "timestamp": metadata.get("timestamp") if metadata else None
            }

            # Add context keywords to metadata
            if context and "queries" in context:
                meta["context_keywords"] = ", ".join(
                    context.get("queries", [])[:5])
                    
            # Add additional metadata
            if metadata:
                for key, value in metadata.items():
                    if key not in meta and value is not None:
                        meta[key] = value

            # Get appropriate collection
            collection = self._get_collection_for_product(product)

            # Add document to collection with product_id as ID
            collection.add(
                documents=[document],
                metadatas=[meta],
                ids=[product_id]
            )
            
            # Invalidate any cached similarity results for this product
            cache_key = product.lower().strip()
            if cache_key in self.similarity_cache:
                del self.similarity_cache[cache_key]

            logger.info(
                f"Added description for {product} to vector store with ID: {product_id}")
            return True
        except Exception as e:
            logger.error(f"Error adding to vector store: {str(e)}")
            return False

    @lru_cache(maxsize=100)  # Cache recent results in memory
    async def find_similar(self, product: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Find similar product descriptions with caching"""
        if not self.client:
            if not self.connect():
                logger.error("Failed to connect to vector store")
                return []

        try:
            cache_key = product.lower().strip()
            
            # Check memory cache first
            if cache_key in self.similarity_cache:
                cache_entry = self.similarity_cache[cache_key]
                # Check if cache is still fresh
                if time.time() - cache_entry['timestamp'] < self.cache_ttl:
                    logger.info(f"Using cached similarity results for: {product}")
                    return cache_entry['results']
            
            # Search each collection and combine results
            all_results = []
            
            # First try the specific collection for this product
            primary_collection = self._get_collection_for_product(product)
            try:
                results = primary_collection.query(
                    query_texts=[product],
                    n_results=limit
                )
                
                if results and results.get("documents") and results["documents"][0]:
                    for i, doc in enumerate(results["documents"][0]):
                        metadata = results["metadatas"][0][i] if results["metadatas"] and i < len(
                            results["metadatas"][0]) else {}
                        all_results.append({
                            "document": doc,
                            "metadata": metadata
                        })
            except Exception as e:
                logger.warning(f"Error querying primary collection: {str(e)}")
            
            # If we don't have enough results, try main collection as backup
            if len(all_results) < limit and "main" in self.collections:
                try:
                    results = self.collections["main"].query(
                        query_texts=[product],
                        n_results=limit - len(all_results)
                    )
                    
                    if results and results.get("documents") and results["documents"][0]:
                        for i, doc in enumerate(results["documents"][0]):
                            metadata = results["metadatas"][0][i] if results["metadatas"] and i < len(
                                results["metadatas"][0]) else {}
                            all_results.append({
                                "document": doc,
                                "metadata": metadata
                            })
                except Exception as e:
                    logger.warning(f"Error querying main collection: {str(e)}")
            
            # Store in memory cache
            self.similarity_cache[cache_key] = {
                'timestamp': time.time(),
                'results': all_results
            }

            logger.info(
                f"Found {len(all_results)} similar descriptions for: {product}")
            return all_results
        except Exception as e:
            logger.error(f"Error querying vector store: {str(e)}")
            return []
            
    async def clear_cache(self):
        """Clear the similarity cache"""
        self.similarity_cache = {}
        # Also clear the lru_cache
        self.find_similar.cache_clear()
        logger.info("Vector store similarity cache cleared")


# Create singleton instance
vector_store = VectorStore()
