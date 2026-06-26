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

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/topics');
        const data = await response.json();
        
        if (data.status === 'success' && data.topics.length > 0) {
          setTopics(data.topics);
          setActiveTopicId(data.topics[0].id); // Auto-select the first topic
        }
      } catch (error) {
        console.error("Failed to load topics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium animate-pulse">Loading Workspace Data...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex">
      {/* Sidebar for Topic Selection */}
      <aside className="w-64 bg-white border-r border-gray-200 p-4 space-y-4 flex flex-col shadow-sm z-10">
        <div className="font-bold text-lg text-gray-800 border-b pb-2">
          CiteOS Workspace
        </div>
        <nav className="flex-1 space-y-1">
          {topics.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No topics found in MongoDB.</p>
          ) : (
            topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setActiveTopicId(topic.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTopicId === topic.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {topic.name}
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main Chat Interface Panel */}
      <section className="flex-1 flex flex-col justify-center p-8">
        <div className="w-full max-w-3xl mx-auto space-y-4">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Research Assistant
            </h1>
            <p className="text-xs text-gray-500 font-mono bg-gray-200 inline-block px-2 py-1 rounded">
              Active Context ID: {activeTopicId || 'None'}
            </p>
          </header>
          
          {activeTopicId && (
            <>
              <DocumentUpload topicId={activeTopicId} />
              <ChatInterface topicId={activeTopicId} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}