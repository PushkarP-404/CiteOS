import os
import asyncio
from dotenv import load_dotenv
import urllib.parse
from motor.motor_asyncio import AsyncIOMotorClient
from qdrant_client import QdrantClient

# Load environment variables
load_dotenv()

async def clear_data():
    print("Starting data cleanup...")

    # 1. Clear Qdrant Vector DB
    qdrant_url = os.getenv("QDRANT_URL")
    if qdrant_url:
        print(f"Connecting to Qdrant at {qdrant_url}")
        qdrant_client = QdrantClient(url=qdrant_url)
        collection_name = "citeos_research"
        
        try:
            # We recreate the collection to wipe all points
            qdrant_client.delete_collection(collection_name=collection_name)
            print(f"Deleted Qdrant collection: {collection_name}")
        except Exception as e:
            print(f"Error deleting Qdrant collection: {e}")
    else:
        print("QDRANT_URL not found in .env!")

    # 2. Clear MongoDB Sources and Messages
    username = os.getenv("MONGO_USERNAME")
    raw_password = os.getenv("MONGO_PASSWORD")
    cluster = os.getenv("MONGO_CLUSTER")

    if username and raw_password and cluster:
        escaped_password = urllib.parse.quote_plus(raw_password)
        mongo_uri = f"mongodb+srv://{username}:{escaped_password}@{cluster}/?retryWrites=true&w=majority"
        
        mongo_client = AsyncIOMotorClient(mongo_uri)
        mongo_db = mongo_client.get_database("citeos_db")
        topics_collection = mongo_db.get_collection("topics")
        messages_collection = mongo_db.get_collection("messages")

        # Clear sources array in all topics
        result_topics = await topics_collection.update_many({}, {"$set": {"sources": []}})
        print(f"Cleared sources for {result_topics.modified_count} topics.")

        # Clear all messages
        result_msgs = await messages_collection.delete_many({})
        print(f"Deleted {result_msgs.deleted_count} old chat messages.")
        
        # Close connection
        mongo_client.close()
    else:
        print("MongoDB credentials missing in .env!")

    print("Cleanup complete!")

if __name__ == "__main__":
    asyncio.run(clear_data())
