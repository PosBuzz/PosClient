import logging
from typing import List, Dict, Any, Optional
import os
from functools import lru_cache
import time
from app.core.config import settings
import chromadb
from chromadb.config import Settings as ChromaSettings
import numpy as np
from langchain_huggingface import HuggingFaceEmbeddings

logger = logging.getLogger(__name__)

# Create a wrapper class to adapt LangChain embeddings to ChromaDB's expected interface
class ChromaEmbeddingAdapter:
    def __init__(self, embedding_function):
        self.embedding_function = embedding_function
        
    def __call__(self, input: List[str]) -> List[List[float]]:
        """Adapt LangChain embedding function to ChromaDB's expected signature"""
        return self.embedding_function(input)

class VectorStore:
    def __init__(self):
        self.client = None
        self.embedder = None
        self.collections = {}  # Multiple collections for partitioning
        self.persist_directory = os.path.abspath(settings.CHROMA_DB_DIR)
        self.similarity_cache = {}  # In-memory cache for similarity results
        self.cache_ttl = settings.VECTOR_STORE_CACHE_TTL  # Use value from settings
        self.use_sharding = settings.CHROMA_COLLECTION_SHARDING  # Use value from settings
        
    def connect(self):
        """Initialize ChromaDB connection with optimized settings and local embeddings"""
        try:
            # Create directory if it doesn't exist
            os.makedirs(self.persist_directory, exist_ok=True)

            # Initialize local embedding model first
            logger.info("Initializing embedding model...")
            self._initialize_embeddings()
            
            logger.info(f"Connecting to ChromaDB at {self.persist_directory}")
            self.client = chromadb.PersistentClient(
                path=self.persist_directory,
                settings=ChromaSettings(
                    anonymized_telemetry=settings.CHROMA_TELEMETRY
                )
            )

            # Default collection is still created for backwards compatibility
            self.collections["main"] = self._create_collection("product_descriptions")
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
                if self.client is None:
                    connected = self.connect()
                    if not connected or self.client is None:
                        logger.error("ChromaDB client is not initialized and failed to connect.")
                        return self.collections["main"]  # Fallback to main
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
            
            # Log the embedding process if we have a local embedder
            if self.embedder:
                logger.info(f"Generating embeddings for query: {product}")
                embed_start = time.time()
                embeddings = self.embedder.embed_documents([product])
                embed_time = time.time() - embed_start
                logger.info(f"Embedding generated in {embed_time:.3f}s with dimension: {len(embeddings[0])}")
        
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

    def _initialize_embeddings(self):
        """Initialize the local embeddings model with detailed logging"""
        try:
            import os
            from huggingface_hub import scan_cache_dir
            
            # Log cache location
            cache_dir = os.path.join(os.environ["USERPROFILE"], ".cache", "huggingface", "hub") if os.name == 'nt' else os.path.expanduser("~/.cache/huggingface/hub")
            if os.path.exists(cache_dir):
                logger.info(f"HuggingFace cache directory exists at: {cache_dir}")
                
                # Scan cache to see what models are available
                cache_info = scan_cache_dir()
                models = [repo.repo_id for repo in cache_info.repos]
                logger.info(f"Models in cache: {models}")
            else:
                logger.info(f"HuggingFace cache directory not found at: {cache_dir}")
            
            # Detect if CUDA is available
            device = "cuda:0" if settings.USE_GPU else "cpu"
            logger.info(f"Initializing embedding model on device: {device}")
            
            # Use a small, efficient model for embeddings
            model_name = settings.EMBEDDING_MODEL
            logger.info(f"Loading embedding model: {model_name}")
            
            start_time = time.time()
            self.embedder = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={'device': device},
                encode_kwargs={'normalize_embeddings': True}
            )
            load_time = time.time() - start_time
            
            # Test the embedder with a simple example
            test_text = "This is a test sentence"
            start_time = time.time()
            test_embedding = self.embedder.embed_documents([test_text])
            embed_time = time.time() - start_time
            
            logger.info(f"✅ Embedding model loaded successfully in {load_time:.2f}s")
            logger.info(f"✅ Test embedding generated in {embed_time:.2f}s with dimension: {len(test_embedding[0])}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {str(e)}")
            # Fall back to ChromaDB's default embeddings
            self.embedder = None
            return False

    def ensure_embeddings_initialized(self):
        """Ensure embeddings are initialized, initializing if needed"""
        if self.embedder is None:
            logger.info("Embeddings not initialized yet, initializing now...")
            return self._initialize_embeddings()
        return True

    def _create_collection(self, name: str):
        """Create a collection with optimized settings"""
        try:
            # Ensure client is initialized
            if self.client is None:
                connected = self.connect()
                if not connected or self.client is None:
                    logger.error("ChromaDB client is not initialized and failed to connect.")
                    raise RuntimeError("ChromaDB client is not initialized.")

            # For collections, use our embedder if available
            if self.embedder:
                logger.info(f"Creating collection {name} with custom embedding function")
                # Pass the embedding function directly as a callable
                return self.client.get_or_create_collection(
                    name=name,
                    metadata={
                        "hnsw:space": "cosine",
                        "hnsw:construction_ef": 128,
                        "hnsw:search_ef": 100,
                        "hnsw:M": 64
                    },
                    embedding_function=self.embedder.embed_documents,  # type: ignore[arg-type]
                )
            else:
                # Use default embeddings
                logger.info(f"Creating collection {name} with default embeddings")
                return self.client.get_or_create_collection(
                    name=name,
                    metadata={
                        "hnsw:space": "cosine",
                        "hnsw:construction_ef": 128,
                        "hnsw:search_ef": 100,
                        "hnsw:M": 64
                    }
                )
        except Exception as e:
            logger.error(f"Error creating collection {name}: {str(e)}")
            # Try without custom embeddings as fallback
            try:
                logger.info(f"Trying to create collection {name} with default embeddings")
                if self.client is None:
                    connected = self.connect()
                    if not connected or self.client is None:
                        logger.error("ChromaDB client is not initialized and failed to connect.")
                        raise RuntimeError("ChromaDB client is not initialized.")
                return self.client.get_or_create_collection(name=name)
            except Exception as e2:
                logger.error(f"Failed to create collection with default settings: {str(e2)}")
                raise
# Create singleton instance
vector_store = VectorStore()
