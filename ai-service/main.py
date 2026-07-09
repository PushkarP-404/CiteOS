import os
import asyncio
import httpx
from groq import Groq
import urllib.parse 
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, date
import fitz
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from typing import List
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from langchain_text_splitters import RecursiveCharacterTextSplitter
from fastembed import TextEmbedding
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson.objectid import ObjectId
import json

# Load the environment variables
load_dotenv()

# Strict Environment Validation Guardrail
required_envs = ["MONGO_USERNAME", "MONGO_PASSWORD", "MONGO_CLUSTER", "GROQ_API_KEY", "QDRANT_URL", "JWT_SECRET_KEY"]
for var in required_envs:
    if not os.getenv(var):
        raise ValueError(f"CRITICAL: Missing environment variable: {var}")

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CiteOS AI Vector Service")

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
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
users_collection = mongo_db.get_collection("users")

# Auth Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Internal service token checker
INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN")
def verify_internal_token(x_internal_token: str = Header(None)):
    if not INTERNAL_TOKEN:
        return True # if no token is set in env, skip check for dev mode
    if x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    return True

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

@app.post("/api/auth/register")
async def register(payload: RegisterRequest):
    existing_user = await users_collection.find_one({"username": payload.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(payload.password)
    user = {"username": payload.username, "password": hashed_password}
    result = await users_collection.insert_one(user)
    
    return {"status": "success", "userId": str(result.inserted_id)}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    user = await users_collection.find_one({"username": payload.username})
    if not user or not verify_password(payload.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": str(user["_id"])})
    return {"status": "success", "access_token": access_token, "token_type": "bearer"}


# ── Citation Formatter Utility ──
def format_citation(meta: dict, style: str = "apa") -> str:
    title = meta.get("title", "Untitled")
    authors = meta.get("authors", "")
    year = meta.get("year", "n.d.")
    url = meta.get("url", "")
    access_date = meta.get("accessDate", date.today().strftime("%B %d, %Y"))
    source_type = meta.get("sourceType", "web")

    if style == "apa":
        if source_type == "scholar":
            return f"{authors} ({year}). {title}. Retrieved from {url}"
        elif source_type == "wikipedia":
            return f"{title}. (n.d.). In Wikipedia. Retrieved {access_date}, from {url}"
        else:
            return f"{title}. Retrieved from {url}"
    elif style == "mla":
        if source_type == "scholar":
            return f"{authors}. \"{title}.\" {year}. Web. {url}"
        elif source_type == "wikipedia":
            return f"\"{title}.\" Wikipedia, Wikimedia Foundation. Web. {access_date}. {url}"
        else:
            return f"\"{title}.\" Web. {url}"
    elif style == "chicago":
        if source_type == "scholar":
            return f"{authors}. \"{title}.\" ({year}). {url}"
        elif source_type == "wikipedia":
            return f"Wikipedia contributors. \"{title}.\" Wikipedia. Accessed {access_date}. {url}"
        else:
            return f"\"{title}.\" {url}"
    elif style == "ieee":
        if source_type == "scholar":
            return f"{authors}, \"{title},\" {year}. [Online]. Available: {url}"
        elif source_type == "wikipedia":
            return f"Wikipedia, \"{title},\" [Online]. Available: {url}. [Accessed: {access_date}]"
        else:
            return f"\"{title},\" [Online]. Available: {url}"
    return f"{title} - {url}"


# Initialize Groq Client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Initialize FastEmbed model (runs locally, zero-compiler overhead)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Initialize Qdrant Client via Environment Variable
qdrant_url = os.getenv("QDRANT_URL")
qdrant_api_key = os.getenv("QDRANT_API_KEY")
if qdrant_api_key:
    qdrant_client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
else:
    qdrant_client = QdrantClient(url=qdrant_url)
COLLECTION_NAME = "citeos_research"

# Ensure the Qdrant collection exists on startup
try:
    qdrant_client.get_collection(collection_name=COLLECTION_NAME)
except Exception:
    qdrant_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

# Ensure payload index exists for topicId filtering
try:
    qdrant_client.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="topicId",
        field_schema="keyword",
    )
except Exception:
    pass  # Index likely already exists

class VectorizeRequest(BaseModel):
    text: List[str]  # The clean text array from the n8n HTML node
    url: str         # The source URL for citation tracking
    topicId: str     # The MongoDB topic identifier string

@app.post("/api/vectorize")
async def vectorize_and_store(payload: VectorizeRequest, _: bool = Depends(verify_internal_token)):
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
            await topics_collection.update_one(
                {"_id": ObjectId(payload.topicId)},
                {"$addToSet": {"sources": payload.url}}
            )

        return {"status": "success", "chunks_processed": len(points)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    topicId: str = Form(...),
    userId: str = Depends(get_current_user)
):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
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
                        "topicId": topicId,
                        "title": file.filename,
                        "sourceType": "pdf"
                    }
                )
            )
            
        if points:
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points
            )
            await topics_collection.update_one(
                {"_id": ObjectId(topicId)},
                {"$addToSet": {"sources": file.filename}}
            )

        return {"status": "success", "chunks_processed": len(points), "filename": file.filename}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QueryRequest(BaseModel):
    query: str       # The question the user typed
    topicId: str     # The MongoDB topic ID to filter by
    limit: int = 5   # How many paragraphs to retrieve

@app.post("/api/query")
async def query_research(payload: QueryRequest, userId: str = Depends(get_current_user)):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(payload.topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
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
async def generate_answer(payload: AskRequest, userId: str = Depends(get_current_user)):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(payload.topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
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

        # 2. Extract text and URLs from the results + compute quality scores
        if not search_result:
             return {"status": "success", "answer": "I do not have enough research in this topic's database to answer that.", "sources": []}

        context_chunks = []
        source_map = {}  # url -> {scores: [], meta: {}, chunks: int}
        
        for hit in search_result:
            url = hit.payload['url']
            context_chunks.append(f"Source [{url}]:\n{hit.payload['text']}")
            
            if url not in source_map:
                source_map[url] = {
                    "scores": [],
                    "meta": {
                        "url": url,
                        "title": hit.payload.get("title", url),
                        "authors": hit.payload.get("authors", ""),
                        "year": hit.payload.get("year", "n.d."),
                        "sourceType": hit.payload.get("sourceType", "web"),
                        "accessDate": hit.payload.get("accessDate", date.today().strftime("%B %d, %Y")),
                    }
                }
            source_map[url]["scores"].append(hit.score)
            
        compiled_context = "\n\n".join(context_chunks)
        
        # 3. Build source details with quality scoring and formatted citations
        source_details = []
        for url, data in source_map.items():
            scores = data["scores"]
            avg_score = sum(scores) / len(scores)
            # Quality = average relevance (0-1) scaled to 0-100, boosted by multiple chunk matches
            chunk_bonus = min(len(scores) * 10, 30)  # up to +30 for multiple matches
            quality = min(round(avg_score * 70 + chunk_bonus), 100)
            
            meta = data["meta"]
            source_details.append({
                "url": url,
                "title": meta["title"],
                "score": quality,
                "matchingChunks": len(scores),
                "citations": {
                    "apa": format_citation(meta, "apa"),
                    "mla": format_citation(meta, "mla"),
                    "chicago": format_citation(meta, "chicago"),
                    "ieee": format_citation(meta, "ieee"),
                }
            })
        
        # Sort by quality score descending
        source_details.sort(key=lambda x: x["score"], reverse=True)

        # 4. Retrieve past chat memory (last 6 messages)
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

        # 5. Construct the strict RAG Prompt
        system_instruction = f"""You are CiteOS, a precision research assistant. 
        Answer the user's question using the provided CONTEXT and PREVIOUS CONVERSATION HISTORY. 
        If the answer cannot be found in the CONTEXT or history, you must explicitly state that you do not know. 
        Do not use outside knowledge. 
        
        {memory_context}
        CONTEXT:
        {compiled_context}
        """
        
        # 6. Create an async generator to yield chunks from Groq
        async def generate_stream():
            # Send the rich source details first so the UI can display them immediately
            yield f"data: {json.dumps({'type': 'source_details', 'data': source_details})}\n\n"
            # Also send flat source list for backward compat
            yield f"data: {json.dumps({'type': 'sources', 'data': [s['url'] for s in source_details]})}\n\n"
            
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
                {"topicId": payload.topicId, "role": "assistant", "content": full_assistant_response, "sources": [s['url'] for s in source_details], "sourceDetails": source_details}
            ])

        # 7. Return the StreamingResponse
        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class TopicCreateRequest(BaseModel):
    name: str

@app.post("/api/topics")
async def create_topic(payload: TopicCreateRequest, userId: str = Depends(get_current_user)):
    try:
        new_topic = {"name": payload.name, "sources": [], "userId": userId}
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

class ResearchRequest(BaseModel):
    topicName: str

@app.post("/api/topics/{topicId}/research")
async def trigger_research(topicId: str, payload: ResearchRequest, userId: str = Depends(get_current_user)):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")

        topic_name = payload.topicName
        sources_found = 0
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

        async with httpx.AsyncClient() as client:
            # ── Source 1: Semantic Scholar (Academic Papers) ──
            try:
                scholar_headers = {}
                scholar_api_key = os.getenv("SEMANTIC_SCHOLAR_API_KEY")
                if scholar_api_key:
                    scholar_headers["x-api-key"] = scholar_api_key

                scholar_resp = await client.get(
                    "https://api.semanticscholar.org/graph/v1/paper/search",
                    params={"query": topic_name, "limit": "5", "fields": "title,abstract,url,authors,year"},
                    headers=scholar_headers,
                    timeout=15.0
                )
                if scholar_resp.status_code == 200:
                    papers = scholar_resp.json().get("data", [])
                    all_scholar_points = []
                    all_scholar_urls = set()
                    
                    for paper in papers:
                        abstract = paper.get("abstract")
                        if not abstract:
                            continue
                        title = paper.get("title", "Unknown")
                        url = paper.get("url") or f"https://semanticscholar.org/paper/{paper.get('paperId', '')}"

                        # Extract author names
                        authors_list = paper.get("authors", [])
                        author_str = ", ".join([a.get("name", "") for a in authors_list[:3]]) if authors_list else "Unknown"
                        if len(authors_list) > 3:
                            author_str += " et al."
                        paper_year = str(paper.get("year", "n.d."))

                        chunks = text_splitter.split_text(abstract)
                        
                        # Offload CPU-heavy embedding to a thread
                        embeddings = await asyncio.to_thread(lambda c=chunks: list(embedding_model.embed(c)))
                        
                        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                            point_id = str(abs(hash(f"{topicId}-{hash(url)}-scholar-{i}")))
                            all_scholar_points.append(PointStruct(
                                id=int(point_id),
                                vector=vector.tolist(),
                                payload={
                                    "text": chunk, "url": url, "topicId": topicId,
                                    "title": title, "authors": author_str,
                                    "year": paper_year, "sourceType": "scholar"
                                }
                            ))
                        all_scholar_urls.add(url)
                    
                    if all_scholar_points:
                        await asyncio.to_thread(qdrant_client.upsert, collection_name=COLLECTION_NAME, points=all_scholar_points)
                        await topics_collection.update_one(
                            {"_id": ObjectId(topicId)},
                            {"$addToSet": {"sources": {"$each": list(all_scholar_urls)}}}
                        )
                        sources_found += len(all_scholar_urls)
                else:
                    print(f"[RESEARCH] Semantic Scholar returned {scholar_resp.status_code}, skipping.")
            except Exception as e:
                print(f"[RESEARCH] Semantic Scholar failed: {e}. Skipping.")

            # ── Source 2: Wikipedia (General Knowledge) ──
            try:
                wiki_search_resp = await client.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={
                        "action": "query", "list": "search",
                        "srsearch": topic_name, "utf8": "", "format": "json"
                    },
                    headers={"User-Agent": "CiteOS-Bot/1.0 (contact@example.com)"},
                    timeout=15.0
                )
                if wiki_search_resp.status_code == 200:
                    search_results = wiki_search_resp.json().get("query", {}).get("search", [])
                    all_wiki_points = []
                    all_wiki_urls = set()
                    
                    for result in search_results[:1]:  # Top 1 Wikipedia article to save CPU
                        wiki_title = result.get("title", "")
                        # Fetch full article text
                        extract_resp = await client.get(
                            "https://en.wikipedia.org/w/api.php",
                            params={
                                "action": "query", "prop": "extracts",
                                "explaintext": "1", "titles": wiki_title, "format": "json"
                            },
                            headers={"User-Agent": "CiteOS-Bot/1.0 (contact@example.com)"},
                            timeout=15.0
                        )
                        if extract_resp.status_code == 200:
                            pages = extract_resp.json().get("query", {}).get("pages", {})
                            page_id = list(pages.keys())[0]
                            full_text = pages[page_id].get("extract", "")
                            if not full_text.strip():
                                continue

                            # Truncate to prevent CPU timeouts on free tier
                            full_text = full_text[:5000]

                            url = f"https://en.wikipedia.org/wiki/{wiki_title.replace(' ', '_')}"
                            today_str = date.today().strftime("%B %d, %Y")
                            chunks = text_splitter.split_text(full_text)
                            
                            # Offload CPU-heavy embedding
                            embeddings = await asyncio.to_thread(lambda c=chunks: list(embedding_model.embed(c)))
                            
                            for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
                                point_id = str(abs(hash(f"{topicId}-{hash(url)}-wiki-{i}")))
                                all_wiki_points.append(PointStruct(
                                    id=int(point_id),
                                    vector=vector.tolist(),
                                    payload={
                                        "text": chunk, "url": url, "topicId": topicId,
                                        "title": wiki_title, "sourceType": "wikipedia",
                                        "accessDate": today_str
                                    }
                                ))
                            all_wiki_urls.add(url)
                            
                    if all_wiki_points:
                        await asyncio.to_thread(qdrant_client.upsert, collection_name=COLLECTION_NAME, points=all_wiki_points)
                        await topics_collection.update_one(
                            {"_id": ObjectId(topicId)},
                            {"$addToSet": {"sources": {"$each": list(all_wiki_urls)}}}
                        )
                        sources_found += len(all_wiki_urls)
            except Exception as e:
                print(f"[RESEARCH] Wikipedia failed: {e}. Skipping.")

        if sources_found == 0:
            return {"status": "warning", "message": "Research completed but no sources were found. Try a different topic name."}

        return {"status": "success", "message": f"Research completed! {sources_found} sources processed and vectorized."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[RESEARCH ERROR] {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics")
async def get_topics(userId: str = Depends(get_current_user)):
    try:
        # We only fetch the ID and the name fields to keep the payload light
        cursor = topics_collection.find({"userId": userId}, {"_id": 1, "name": 1, "sources": 1})
        topics = []
        
        async for document in cursor:
            topics.append({
                "id": str(document["_id"]),
                "name": document.get("name", "Unnamed Topic"),
                "sources": document.get("sources", [])
            })
            
        return {"status": "success", "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics/{topicId}/messages")
async def get_topic_messages(topicId: str, userId: str = Depends(get_current_user)):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
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


@app.get("/api/topics/{topicId}/export")
async def export_topic(topicId: str, style: str = "apa", userId: str = Depends(get_current_user)):
    try:
        # Verify topic belongs to user
        topic = await topics_collection.find_one({"_id": ObjectId(topicId), "userId": userId})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
        
        topic_name = topic.get("name", "Untitled Topic")
        
        # Fetch all messages
        cursor = messages_collection.find({"topicId": topicId}).sort("_id", 1)
        messages = []
        async for doc in cursor:
            messages.append(doc)
        
        # Build markdown document
        md = f"# {topic_name}\n\n"
        md += f"*Exported from CiteOS on {date.today().strftime('%B %d, %Y')}*\n\n"
        md += "---\n\n"
        
        all_sources = {}  # url -> citation
        citation_index = 1
        url_to_index = {}
        
        for msg in messages:
            if msg.get("role") == "user":
                md += f"## Q: {msg.get('content', '')}\n\n"
            elif msg.get("role") == "assistant":
                md += f"{msg.get('content', '')}\n\n"
                # Collect source details for bibliography safely
                source_details = msg.get("sourceDetails") or []
                if source_details:
                    md += "**Sources used:**\n"
                    for sd in source_details:
                        url = sd.get("url", "")
                        if url not in url_to_index:
                            url_to_index[url] = citation_index
                            meta = {
                                "url": url,
                                "title": sd.get("title", url),
                                "authors": sd.get("authors", ""),
                                "year": sd.get("year", "n.d."),
                                "sourceType": sd.get("sourceType", "web"),
                                "accessDate": sd.get("accessDate", date.today().strftime("%B %d, %Y")),
                            }
                            all_sources[url] = format_citation(meta, style)
                            citation_index += 1
                        md += f"- [{url_to_index[url]}] {sd.get('title', url)} (Quality: {sd.get('score', 'N/A')}%)\n"
                    md += "\n"
                # Fallback for older messages without sourceDetails
                elif msg.get("sources"):
                    sources_list = msg.get("sources") or []
                    for src_url in sources_list:
                        if src_url not in url_to_index:
                            url_to_index[src_url] = citation_index
                            all_sources[src_url] = format_citation({"url": src_url, "title": src_url}, style)
                            citation_index += 1
                md += "---\n\n"
        
        # Add bibliography
        if all_sources:
            md += f"## References ({style.upper()})\n\n"
            for url, citation in all_sources.items():
                idx = url_to_index[url]
                md += f"[{idx}] {citation}\n\n"
        
        # Sanitize filename for HTTP header
        safe_filename = urllib.parse.quote(topic_name.replace(" ", "_"))
        
        from fastapi.responses import Response
        return Response(
            content=md,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}_notes.md"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[EXPORT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)