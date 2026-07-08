"use client";

import { useState, useEffect, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth';

// Define the TypeScript contract for the component props
interface ChatInterfaceProps {
  topicId: string;
  citationStyle: string;
}

interface SourceDetail {
  url: string;
  title: string;
  score: number;
  matchingChunks: number;
  citations: {
    apa: string;
    mla: string;
    chicago: string;
    ieee: string;
  };
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  sourceDetails?: SourceDetail[];
}

export default function ChatInterface({ topicId, citationStyle }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages when topicId changes
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/topics/${topicId}/messages`, {
          headers: getAuthHeaders()
        });
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

  // Scroll to bottom only when a new message is added, not during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    const userQuery = query;
    setQuery('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    // Add empty assistant message placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [], sourceDetails: [] }]);
    
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
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
                const lastMsg = { ...newMessages[newMessages.length - 1] };
                if (parsed.type === 'source_details') {
                  lastMsg.sourceDetails = parsed.data;
                } else if (parsed.type === 'sources') {
                  lastMsg.sources = parsed.data;
                } else if (parsed.type === 'text') {
                  lastMsg.content += parsed.data;
                }
                newMessages[newMessages.length - 1] = lastMsg;
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

  const getQualityColor = (score: number) => {
    if (score >= 75) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    if (score >= 25) return 'bg-orange-500';
    return 'bg-red-400';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 75) return 'Strong';
    if (score >= 50) return 'Moderate';
    if (score >= 25) return 'Weak';
    return 'Low';
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
              
              {/* Rich Source Details with Quality Scoring */}
              {msg.role === 'assistant' && msg.sourceDetails && msg.sourceDetails.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-[var(--margin-line)]">
                  <h4 className="text-lg font-bold mb-3 font-sans">References</h4>
                  <div className="space-y-3">
                    {msg.sourceDetails.map((source, sIdx) => (
                      <div key={sIdx} className="p-3 border border-dashed border-[var(--margin-line)] rounded-md bg-[var(--line-color)] bg-opacity-30">
                        {/* Citation Text */}
                        <p className="text-base font-sans leading-snug text-[var(--foreground)] opacity-90 mb-2">
                          [{sIdx + 1}] {source.citations[citationStyle as keyof typeof source.citations] || source.citations.apa}
                        </p>
                        
                        {/* Quality Bar + Metadata Row */}
                        <div className="flex items-center gap-3 text-sm font-sans">
                          {/* Quality Score Bar */}
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs opacity-60 whitespace-nowrap">
                              Quality:
                            </span>
                            <div className="flex-1 max-w-[120px] h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${getQualityColor(source.score)}`}
                                style={{ width: `${source.score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${
                              source.score >= 75 ? 'text-green-600 dark:text-green-400' :
                              source.score >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-orange-600 dark:text-orange-400'
                            }`}>
                              {source.score}% {getQualityLabel(source.score)}
                            </span>
                          </div>
                          
                          {/* Matching Chunks */}
                          <span className="text-xs opacity-50">
                            {source.matchingChunks} chunk{source.matchingChunks > 1 ? 's' : ''} matched
                          </span>
                          
                          {/* Link */}
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >
                            Open →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback: plain sources for older messages without sourceDetails */}
              {msg.role === 'assistant' && (!msg.sourceDetails || msg.sourceDetails.length === 0) && msg.sources && msg.sources.length > 0 && (
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