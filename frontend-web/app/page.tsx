"use client";

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';

// Mock topics representing what will come from your backend later
const MOCK_TOPICS = [
  { id: "topic-ml-internship", name: "Machine Learning Internship Prep" },
  { id: "topic-discrete-math", name: "Discrete Mathematics Exam Notes" },
  { id: "topic-web-performance", name: "Next.js & Web Performance" }
];

export default function Home() {
  const [activeTopicId, setActiveTopicId] = useState(MOCK_TOPICS[0].id);

  return (
    <main className="min-h-screen bg-gray-50 flex">
      {/* Sidebar for Topic Selection */}
      <aside className="w-64 bg-white border-r border-gray-200 p-4 space-y-4 flex flex-col shadow-sm z-10">
        <div className="font-bold text-lg text-gray-800 border-b pb-2">
          CiteOS Workspace
        </div>
        <nav className="flex-1 space-y-1">
          {MOCK_TOPICS.map((topic) => (
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
          ))}
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
              Active Context ID: {activeTopicId}
            </p>
          </header>
          
          {/* Pass the active topic state down as a prop */}
          <ChatInterface topicId={activeTopicId} />
        </div>
      </section>
    </main>
  );
}