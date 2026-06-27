import os
from groq import Groq
import urllib.parse 
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
import fitz
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastembed import TextEmbedding
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
import json

# Load the environment variables
load_dotenv()

# Strict Environment Validation Guardrail
required_envs = ["MONGO_USERNAME", "MONGO_PASSWORD", "MONGO_CLUSTER", "GROQ_API_KEY", "QDRANT_URL"]
for var in required_envs:
    if not os.getenv(var):
        raise ValueError(f"CRITICAL: Missing environment variable: {var}")

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CiteOS AI Vector Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MongoDB Client safely
username = os.getenv("MONGO_USERNAME")
raw_password = os.getenv("MONGO_PASSWORD")
cluster = os.getenv("MONGO_CLUSTER")

escaped_password = urllib.parse.quote_plus(raw_password)
MONGO_URI = f"mongodb+srv://{username}:{escaped_password}@{cluster}/?retryWrites=true&w=majority"

mongo_client = AsyncIOMotorClient(MONGO_URI)
mongo_db = mongo_client.get_database("citeos_db") 
topics_collection = mongo_db.get_collection("topics")
messages_collection = mongo_db.get_collection("messages")

# Initialize Groq Client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Initialize FastEmbed model (runs locally, zero-compiler overhead)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Initialize Qdrant Client via Environment Variable
qdrant_client = QdrantClient(url=os.getenv("QDRANT_URL"))
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
    
@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    topicId: str = Form(...)
):
    try:
        # Read the file content
        content = await file.read()
        
        # Extract text using PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        text_pages = [page.get_text() for page in doc]
        full_text = "\n".join(text_pages)
        
        if not full_text.strip():
            return {"status": "skipped", "message": "No text content found in PDF."}
        
        # Chunk text intelligently
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50
        )
        chunks = text_splitter.split_text(full_text)
        
        # Generate all embeddings in a fast, single batch pass
        embeddings = list(embedding_model.embed(chunks))
        
        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            point_id = f"{topicId}-{hash(file.filename)}-{i}"
            point_id = str(abs(hash(point_id)))

            points.append(
                PointStruct(
                    id=int(point_id),
                    vector=vector.tolist(),
                    payload={
                        "text": chunk,
                        "url": file.filename,
                        "topicId": topicId
                    }
                )
            )
            
        if points:
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points
            )

        return {"status": "success", "chunks_processed": len(points), "filename": file.filename}

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
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="topicId",
                        match=MatchValue(value=payload.topicId),
                    )
                ]
            ),
            limit=payload.limit
        ).points

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
        
        search_result = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="topicId",
                        match=MatchValue(value=payload.topicId),
                    )
                ]
            ),
            limit=payload.limit
        ).points

        # 2. Extract text and URLs from the results
        if not search_result:
             return {"status": "success", "answer": "I do not have enough research in this topic's database to answer that.", "sources": []}

        context_chunks = []
        source_urls = set()
        
        for hit in search_result:
            context_chunks.append(f"Source [{hit.payload['url']}]:\n{hit.payload['text']}")
            source_urls.add(hit.payload['url'])
            
        compiled_context = "\n\n".join(context_chunks)

        # 3. Retrieve past chat memory (last 6 messages)
        cursor = messages_collection.find({"topicId": payload.topicId}).sort("_id", -1).limit(6)
        past_messages = []
        async for msg in cursor:
            past_messages.append(msg)
        past_messages.reverse()
        
        memory_context = ""
        if past_messages:
            memory_context = "PREVIOUS CONVERSATION HISTORY:\n"
            for m in past_messages:
                role = "User" if m["role"] == "user" else "Assistant"
                memory_context += f"{role}: {m['content']}\n"
            memory_context += "\n"

        # 4. Construct the strict RAG Prompt
        system_instruction = f"""You are CiteOS, a precision research assistant. 
        Answer the user's question using the provided CONTEXT and PREVIOUS CONVERSATION HISTORY. 
        If the answer cannot be found in the CONTEXT or history, you must explicitly state that you do not know. 
        Do not use outside knowledge. 
        
        {memory_context}
        CONTEXT:
        {compiled_context}
        """
        
        # 5. Create an async generator to yield chunks from Groq
        async def generate_stream():
            # Send the initial citations first so the UI can display them immediately
            yield f"data: {json.dumps({'type': 'sources', 'data': list(source_urls)})}\n\n"
            
            # Stream the response from Groq's ultra-fast Llama 3 API
            stream = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {'role': 'system', 'content': system_instruction},
                    {'role': 'user', 'content': payload.query}
                ],
                stream=True
            )
            
            full_assistant_response = ""
            for chunk in stream:
                # Groq returns tokens inside the choices[0].delta.content path
                token = chunk.choices[0].delta.content
                if token is not None:
                    full_assistant_response += token
                    yield f"data: {json.dumps({'type': 'text', 'data': token})}\n\n"
                
            yield "data: [DONE]\n\n"
            
            # Save the interaction to memory asynchronously after streaming
            await messages_collection.insert_many([
                {"topicId": payload.topicId, "role": "user", "content": payload.query},
                {"topicId": payload.topicId, "role": "assistant", "content": full_assistant_response, "sources": list(source_urls)}
            ])

        # 6. Return the StreamingResponse
        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class TopicCreateRequest(BaseModel):
    name: str

@app.post("/api/topics")
async def create_topic(payload: TopicCreateRequest):
    try:
        new_topic = {"name": payload.name}
        result = await topics_collection.insert_one(new_topic)
        
        return {
            "status": "success",
            "topic": {
                "id": str(result.inserted_id),
                "name": payload.name
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics")
async def get_topics():
    try:
        # We only fetch the ID and the name fields to keep the payload light
        cursor = topics_collection.find({}, {"_id": 1, "name": 1})
        topics = []
        
        async for document in cursor:
            topics.append({
                "id": str(document["_id"]),
                "name": document.get("name", "Unnamed Topic")
            })
            
        return {"status": "success", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics/{topicId}/messages")
async def get_topic_messages(topicId: str):
    try:
        cursor = messages_collection.find({"topicId": topicId}).sort("_id", 1)
        messages = []
        async for doc in cursor:
            messages.append({
                "id": str(doc["_id"]),
                "role": doc.get("role"),
                "content": doc.get("content"),
                "sources": doc.get("sources", [])
            })
        return {"status": "success", "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)