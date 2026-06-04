# CiteOS
An autonomous research engine utilizing agentic web scraping and citation-enforced RAG to generate perfectly sourced, hallucination-free reports.



Trigger (React & Node.js): The user requests a complex topic via the frontend, which logs the task in MongoDB and triggers the agentic loop.

Ingest (n8n): Autonomous workflows search the web, scrape unstructured HTML, and clean it into pure Markdown.

Vectorize (Python & Qdrant): A FastAPI microservice chunks the text, creates embeddings, and stores them in a vector database with strict URL metadata.

Generate (Citation-Enforced RAG): The AI drafts a comprehensive report, strictly enforcing exact inline citations [URL] for every factual claim made.
