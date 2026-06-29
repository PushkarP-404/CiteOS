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
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-8">
        {messages.length === 0 && !isLoading && (
          <div className="text-center font-handwriting text-2xl text-[var(--foreground)] opacity-50 mt-10">
            No notes here yet. Jot something down!
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className="flex flex-col w-full">
            <div 
              className={`p-1 font-handwriting text-2xl leading-[2rem] w-full ${
                msg.role === 'user' 
                  ? 'text-blue-700 dark:text-blue-400 font-semibold' 
                  : 'text-[var(--foreground)]'
              }`}
            >
              <div className="whitespace-pre-wrap">
                {msg.role === 'user' ? `Q: ${msg.content}` : `A: ${msg.content}`}
              </div>
              
              {/* Display Sources if Assistant */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-2 border-t border-dashed border-[var(--margin-line)] opacity-80">
                  <h4 className="text-lg font-bold">References:</h4>
                  <ul className="list-decimal pl-6 space-y-1">
                    {msg.sources.map((url, sIdx) => (
                      <li key={sIdx}>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
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
      <div className="p-2 mt-4 border-t-2 border-[var(--margin-line)]">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 items-end">
          <textarea
            className="flex-1 p-2 bg-transparent border-b-2 border-dashed border-[var(--foreground)] focus:border-blue-500 focus:outline-none resize-none font-handwriting text-2xl leading-relaxed text-[var(--foreground)]"
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder={`Jot down a question... (Press Enter to submit)`}
            disabled={isLoading}
          />
          <button 
            className="px-4 py-2 font-handwriting text-2xl font-bold text-blue-700 dark:text-blue-400 hover:scale-110 transition-transform disabled:opacity-50"
            onClick={handleAsk}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? '...' : 'Scribble ➔'}
          </button>
        </div>
        <p className="text-center text-xs text-[var(--foreground)] opacity-60 mt-3 font-sans">
          CiteOS synthesizes insights from your documents. Verify critical findings against the provided source citations.
        </p>
      </div>
    </div>
  );
}