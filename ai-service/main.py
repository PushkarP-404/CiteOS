import os
import ollama
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastembed import TextEmbedding
from fastapi.responses import StreamingResponse
import json

app = FastAPI(title="CiteOS AI Vector Service")

# [Certain] Initialize FastEmbed model (runs locally, zero-compiler overhead)
# This default model outputs 384-dimensional vectors matching our config
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Initialize Qdrant Client (Points to your local Docker Qdrant instance)
qdrant_client = QdrantClient(url="http://localhost:6333")
COLLECTION_NAME = "citeos_research"

# Ensure the Qdrant collection exists on startup
try:
    qdrant_client.get_collection(collection_name=COLLECTION_NAME)
except Exception:
    qdrant_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

class VectorizeRequest(BaseModel):
    text: List[str]  # The clean text array from the n8n HTML node
    url: str         # The source URL for citation tracking
    topicId: str     # The MongoDB topic identifier string

@app.post("/api/vectorize")
async def vectorize_and_store(payload: VectorizeRequest):
    try:
        full_text = "\n".join(payload.text)
        if not full_text.strip():
            return {"status": "skipped", "message": "No text content found to process."}

        # Chunk text intelligently
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )
        chunks = text_splitter.split_text(full_text)
        
        # Generate all embeddings in a fast, single batch pass
        # list() converts the generator output directly to dense vector arrays
        embeddings = list(embedding_model.embed(chunks))
        
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            point_id = f"{payload.topicId}-{hash(payload.url)}-{i}"
            point_id = str(abs(hash(point_id)))

            points.append(
                PointStruct(
                    id=int(point_id),
                    vector=vector.tolist(),
                    payload={
                        "text": chunk,
                        "url": payload.url,
                        "topicId": payload.topicId
                    }
                )
            )
            
        if points:
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points
            )

        return {"status": "success", "chunks_processed": len(points)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class QueryRequest(BaseModel):
    query: str       # The question the user typed
    topicId: str     # The MongoDB topic ID to filter by
    limit: int = 5   # How many paragraphs to retrieve

@app.post("/api/query")
async def query_research(payload: QueryRequest):
    try:
        # 1. Embed the user's search query using the exact same FastEmbed model
        # We wrap it in a list to satisfy the embed() generator, then extract the first (and only) vector
        query_vector = list(embedding_model.embed([payload.query]))[0].tolist()

        # 2. Perform a similarity search in Qdrant, STRICTLY filtered by topicId
        search_result = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="topicId",
                        match=MatchValue(value=payload.topicId),
                    )
                ]
            ),
            limit=payload.limit
        )

        # 3. Format the retrieved chunks for the LLM
        results = []
        for hit in search_result:
            results.append({
                "relevance_score": hit.score,
                "text": hit.payload["text"],
                "url": hit.payload["url"]
            })

        return {"status": "success", "results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class AskRequest(BaseModel):
    query: str
    topicId: str
    limit: int = 5

@app.post("/api/ask")
async def generate_answer(payload: AskRequest):
    try:
        # 1. Retrieve relevant context from Qdrant
        query_vector = list(embedding_model.embed([payload.query]))[0].tolist()
        
        search_result = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="topicId",
                        match=MatchValue(value=payload.topicId),
                    )
                ]
            ),
            limit=payload.limit
        )

        # 2. Extract text and URLs from the results
        if not search_result:
             return {"status": "success", "answer": "I do not have enough research in this topic's database to answer that.", "sources": []}

        context_chunks = []
        source_urls = set()
        
        for hit in search_result:
            context_chunks.append(f"Source [{hit.payload['url']}]:\n{hit.payload['text']}")
            source_urls.add(hit.payload['url'])
            
        compiled_context = "\n\n".join(context_chunks)

        # 3. Construct the strict RAG Prompt
        system_instruction = f"""You are CiteOS, a precision research assistant. 
        Answer the user's question using ONLY the provided CONTEXT. 
        If the answer cannot be found in the CONTEXT, you must explicitly state that you do not know. 
        Do not use outside knowledge. 
        
        CONTEXT:
        {compiled_context}
        """

        # 4. Create an async generator to yield chunks
        async def generate_stream():
            # Send the initial citations first so the UI can display them immediately
            yield f"data: {json.dumps({'type': 'sources', 'data': list(source_urls)})}\n\n"
            
            # Stream the Ollama response
            stream = ollama.chat(model='llama3', messages=[
                {'role': 'system', 'content': system_instruction},
                {'role': 'user', 'content': payload.query}
            ], stream=True)
            
            for chunk in stream:
                yield f"data: {json.dumps({'type': 'text', 'data': chunk['message']['content']})}\n\n"
                
            yield "data: [DONE]\n\n"

        # 5. Return the StreamingResponse
        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)