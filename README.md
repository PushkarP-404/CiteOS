# CiteOS
An autonomous research engine utilizing agentic web scraping and citation-enforced RAG to generate perfectly sourced, hallucination-free reports.

## Architecture Overview
- **Trigger (React & Node.js)**: The user requests a complex topic via the frontend, which logs the task in MongoDB and triggers the agentic loop.
- **Ingest (n8n & FastAPI)**: Autonomous workflows search the web, scrape unstructured HTML, and clean it into pure Markdown. Users can also directly upload PDF documents.
- **Vectorize (Python & Qdrant)**: A FastAPI microservice chunks the text, creates embeddings, and stores them in a vector database with strict URL metadata.
- **Generate (Citation-Enforced RAG)**: The AI drafts a comprehensive report, strictly enforcing exact inline citations [URL] for every factual claim made.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Docker & Docker Compose
- MongoDB Atlas Cluster
- Groq API Key

### 2. Infrastructure Setup (Qdrant Vector DB)
CiteOS requires Qdrant to store and query vector embeddings. Start it using Docker Compose:
```bash
docker-compose up -d
```
*This exposes Qdrant on `http://localhost:6333`.*

### 3. Backend Setup (FastAPI AI Service)
Navigate to the `ai-service` directory and install the required Python dependencies:
```bash
# Optionally, create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r ../requirements.txt
```

Create a `.env` file in the `ai-service/` directory with the following variables:
```env
MONGO_USERNAME=your_mongo_username
MONGO_PASSWORD=your_mongo_password
MONGO_CLUSTER=cluster0.xxxxx.mongodb.net
GROQ_API_KEY=gsk_your_groq_api_key
QDRANT_URL=http://localhost:6333
```

Run the FastAPI server:
```bash
cd ai-service
python main.py
# Or use uvicorn directly: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
*The API will be available at `http://localhost:8000`.*

### 4. Frontend Setup (Next.js)
Navigate to the `frontend-web` directory and install the Node modules:
```bash
cd frontend-web
npm install
```

Start the Next.js development server:
```bash
npm run dev
```
*The web interface will be available at `http://localhost:3000`.*
