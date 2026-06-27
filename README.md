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

---

## 📖 CiteOS User Guide (Non-Technical)

CiteOS is your private, intelligent research assistant. It allows you to create individual research topics, upload reference materials (like PDFs), and chat with an AI that draws answers *only* from the documents you provide. This ensures that the answers are accurate, grounded in facts, and always properly cited.

Here is how you can use CiteOS step-by-step:

### 1. Understanding the Workspace & Topics
When you open CiteOS (typically at `http://localhost:3000`), you will see a sidebar on the left representing your active workspace.
- **Topics**: These are independent research folders. For example, you can create a topic called *"Quantum Computing"* and another called *"Ancient History"*.
- **Creating a Topic**: Scroll to the bottom of the left sidebar, enter a name in the **New Topic** field, and click **Add**. The topic will be created, saved, and automatically selected.

### 2. Feeding Research Materials to a Topic
Once a topic is active, you need to populate it with source documents.
- **Uploading PDFs**: Use the upload box on the dashboard to select any PDF. Once uploaded, CiteOS reads the PDF, breaks it down, and processes it into a searchable knowledge base specifically for that active topic.
- **Web Scraping (Optional/Automated)**: You can also utilize automated agents (like n8n workflows) to feed parsed web links directly into the active topic's database.

### 3. Asking Questions & Chatting
With your documents uploaded, you can start conversing with the AI using the chat interface.
- **Strict Citation-Enforced Answers**: Ask any question in the chat box. CiteOS will retrieve relevant snippets from your uploaded documents and answer your question. 
- **Verifying Sources**: Every response from the assistant includes a **Sources** section showing exactly which files or URLs were referenced.
- **Conversational Memory**: You can ask follow-up questions. For example, if you ask *"What is the main finding?"*, you can follow up with *"Can you list its key components?"* and the AI will remember what you are referring to.

### 4. Returning to Your Work
CiteOS automatically saves your conversations and workspace configurations to MongoDB in the background.
- **Persistence**: If you close the browser and return later, simply click on the topic in the sidebar. CiteOS will reload your previous conversation history and continue to answer questions based on the documents uploaded to that topic.
