"use client";

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import DocumentUpload from '@/components/DocumentUpload';

interface Topic {
  id: string;
  name: string;
}

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeTopicId, setActiveTopicId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [newTopicName, setNewTopicName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isResearching, setIsResearching] = useState(false);

  // Toggle dark mode by adding/removing 'dark' class on HTML element
  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/topics');
        const data = await response.json();
        
        if (data.status === 'success' && data.topics.length > 0) {
          setTopics(data.topics);
          // Removed auto-select so user sees the welcome cover first
        }
      } catch (error) {
        console.error("Failed to load topics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, []);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('http://localhost:8000/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTopicName.trim() })
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        setTopics([...topics, data.topic]);
        setActiveTopicId(data.topic.id);
        setNewTopicName('');
      }
    } catch (error) {
      console.error("Failed to create topic:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAutoResearch = async () => {
    if (!activeTopicId) return;
    const topicName = topics.find(t => t.id === activeTopicId)?.name;
    
    setIsResearching(true);
    try {
      // Send webhook to n8n
      await fetch('http://localhost:5678/webhook/wikipedia-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: activeTopicId, topicName })
      });
      alert('Research complete! The agents have found and processed relevant Wikipedia articles into your database.');
    } catch (error) {
      console.error("Webhook failed:", error);
      alert('Failed to reach the n8n webhook. Ensure your n8n workflow is imported and active!');
    } finally {
      setIsResearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium animate-pulse">Loading Workspace Data...</p>
      </div>
    );
  }

  return (
    <main className="h-screen flex bg-transparent overflow-hidden relative">
      {/* CiteOS Background Logo / Home Button */}
      <button 
        onClick={() => setActiveTopicId('')}
        className="absolute top-8 right-12 font-handwriting text-5xl font-bold text-[var(--foreground)] opacity-30 hover:opacity-70 transition-opacity select-none cursor-pointer z-50"
      >
        Cite<span className="text-orange-500">OS</span>
      </button>

      {/* Sidebar for Topic Selection - Acts as the Red Margin */}
      <aside className="w-64 notebook-margin p-6 space-y-6 flex flex-col z-10 h-full bg-transparent overflow-y-auto shrink-0">
        <div className="flex items-center justify-between font-handwriting font-bold text-2xl text-[var(--foreground)] border-b border-[var(--margin-line)] pb-2">
          <span>Topics</span>
          <button 
            onClick={toggleDarkMode}
            className="text-sm px-2 py-1 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors font-sans"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? '🌙' : '☀️'}
          </button>
        </div>
        <nav className="flex-1 space-y-2 pt-4">
          {topics.length === 0 ? (
            <p className="text-sm font-handwriting italic opacity-60">No topics found...</p>
          ) : (
            topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setActiveTopicId(topic.id)}
                className={`w-full text-left px-3 py-1 text-xl font-handwriting transition-all relative ${
                  activeTopicId === topic.id
                    ? 'text-blue-600 font-bold scale-105 ml-2'
                    : 'text-[var(--foreground)] opacity-70 hover:opacity-100 hover:ml-1'
                }`}
              >
                {activeTopicId === topic.id && <span className="absolute -left-3">»</span>}
                {topic.name}
              </button>
            ))
          )}
        </nav>
        
        {/* Create Topic Form */}
        <form onSubmit={handleCreateTopic} className="mt-auto pt-6 border-t border-[var(--margin-line)]">
          <label htmlFor="new-topic" className="block text-lg font-handwriting mb-2">
            + Add Topic
          </label>
          <div className="flex space-x-2">
            <input
              id="new-topic"
              type="text"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="e.g., Space Travel"
              className="flex-1 min-w-0 block w-full px-2 py-1 bg-transparent border-b border-dashed border-[var(--foreground)] text-lg font-handwriting focus:outline-none focus:border-blue-500"
              disabled={isCreating}
            />
            <button
              type="submit"
              disabled={isCreating || !newTopicName.trim()}
              className="px-2 text-xl font-handwriting text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              ✓
            </button>
          </div>
        </form>
      </aside>

      {/* Main Chat Interface Panel */}
      <section className="flex-1 flex flex-col p-8 pt-12 bg-transparent h-full overflow-hidden">
        <div className="w-full max-w-4xl mx-auto flex flex-col h-full space-y-4">
          {activeTopicId ? (
            <>
              <header className="shrink-0 mb-4 flex justify-between items-end border-b-2 border-dashed border-[var(--foreground)] pb-4">
                <h1 className="text-4xl font-handwriting font-bold text-[var(--foreground)]">
                  Research Notes: {topics.find(t => t.id === activeTopicId)?.name || 'Select a topic'}
                </h1>
                <button
                  onClick={handleAutoResearch}
                  disabled={isResearching}
                  className="px-4 py-2 font-handwriting text-2xl font-bold bg-[var(--line-color)] border-2 border-[var(--margin-line)] text-[var(--foreground)] hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors transform -rotate-2 hover:rotate-0 disabled:opacity-50"
                  title="Command AI to scrape the web for documents"
                >
                  {isResearching ? 'Scraping Web...' : 'Auto-Research Web'}
                </button>
              </header>
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <div className="shrink-0">
                  <DocumentUpload topicId={activeTopicId} />
                </div>
                <ChatInterface topicId={activeTopicId} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 opacity-80 mt-10">
              <h2 className="text-6xl font-handwriting font-bold mb-8">
                Welcome to Cite<span className="text-orange-500">OS</span>
              </h2>
              
              <div className="bg-[var(--line-color)] p-8 rounded-lg shadow-sm border border-[var(--margin-line)] transform -rotate-1 hover:rotate-0 transition-transform">
                <h3 className="text-3xl font-handwriting font-bold mb-6 underline decoration-wavy decoration-blue-500">
                  How to Use:
                </h3>
                <ul className="text-3xl font-handwriting space-y-6 max-w-lg">
                  <li className="flex items-center"><span className="text-blue-600 font-bold mr-4">1.</span> Create a topic in the margin</li>
                  <li className="flex items-center"><span className="text-blue-600 font-bold mr-4">2.</span> Upload reference materials</li>
                  <li className="flex items-center"><span className="text-blue-600 font-bold mr-4">3.</span> Ask questions!</li>
                </ul>
              </div>

              <p className="text-2xl font-handwriting mt-12 text-center max-w-md border-t-2 border-dashed border-[var(--foreground)] pt-6">
                * All answers are strictly grounded in your documents with exact citations. *
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}