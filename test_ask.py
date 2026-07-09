import os
import asyncio
from dotenv import load_dotenv
load_dotenv("ai-service/.env")

from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from groq import Groq

async def main():
    try:
        print("Loading embedding model...")
        embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        print("Embedding query...")
        query = "What is the history of space travel?"
        query_vector = list(embedding_model.embed([query]))[0].tolist()

        print("Connecting to Qdrant...")
        qdrant_url = os.getenv("QDRANT_URL")
        qdrant_api_key = os.getenv("QDRANT_API_KEY")
        qdrant_client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)

        print("Querying Qdrant...")
        search_result = qdrant_client.query_points(
            collection_name="citeos_research",
            query=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="topicId",
                        match=MatchValue(value="6a4e28a8fe99818dc9666dae"),
                    )
                ]
            ),
            limit=5
        ).points
        print(f"Found {len(search_result)} results.")

        print("Connecting to Groq...")
        groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        print("Testing Groq...")
        stream = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {'role': 'system', 'content': "You are an assistant."},
                {'role': 'user', 'content': "Hello"}
            ],
            stream=True
        )
        for chunk in stream:
            pass
        print("Groq stream completed.")

    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
