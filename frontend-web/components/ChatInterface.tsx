"use client";

import { useState, useEffect, useRef } from 'react';

// Define the TypeScript contract for the component props
interface ChatInterfaceProps {
  topicId: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export default function ChatInterface({ topicId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages when topicId changes
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/topics/${topicId}/messages`);
        const data = await response.json();
        if (data.status === 'success') {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Failed to fetch messages", error);
      }
    };
    
    setMessages([]); // Clear on topic switch
    if (topicId) {
      fetchMessages();
    }
  }, [topicId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    const userQuery = query;
    setQuery('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    // Add empty assistant message placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }]);
    
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          topicId: topicId
        }),
      });

      if (!response.body) throw new Error('No readable stream available');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(dataStr);
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (parsed.type === 'sources') {
                  lastMsg.sources = parsed.data;
                } else if (parsed.type === 'text') {
                  lastMsg.content += parsed.data;
                }
                return newMessages;
              });
            } catch (e) {
              // Ignore incomplete JSON chunks in the buffer
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch stream", error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        lastMsg.content = "Error: Failed to connect to the local AI service. Is your Python server running?";
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 mt-10">
            No messages yet. Ask a question to start researching!
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`flex flex-col space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[85%] p-4 rounded-xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed text-sm">
                {msg.content}
              </div>
              
              {/* Display Sources if Assistant */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 mb-1">Sources:</h4>
                  <ul className="list-disc pl-4 text-xs space-y-1 text-gray-600">
                    {msg.sources.map((url, sIdx) => (
                      <li key={sIdx}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200 rounded-b-lg">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <textarea
            className="flex-1 p-3 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-sm text-gray-800"
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder={`Ask CiteOS about topic: ${topicId}... (Press Enter to submit)`}
            disabled={isLoading}
          />
          <button 
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors sm:self-end"
            onClick={handleAsk}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? 'Thinking...' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  );
}