"use client";

import { useState } from 'react';

// Define the TypeScript contract for the component props
interface ChatInterfaceProps {
  topicId: string;
}

export default function ChatInterface({ topicId }: ChatInterfaceProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async () => {
    setIsLoading(true);
    setAnswer('');
    setSources([]);

    try {
      const response = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          topicId: topicId // Dynamically using the active sidebar topic
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
              if (parsed.type === 'sources') {
                setSources(parsed.data);
              } else if (parsed.type === 'text') {
                // Append the new token to the existing answer
                setAnswer((prev) => prev + parsed.data);
              }
            } catch (e) {
              // Ignore incomplete JSON chunks in the buffer
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch stream", error);
      setAnswer("Error: Failed to connect to the local AI service. Is your Python server running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <textarea
        className="w-full p-4 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
        rows={3}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Ask your database about topic: ${topicId}...`}
      />
      <button 
        className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        onClick={handleAsk}
        disabled={isLoading || !query.trim()}
      >
        {isLoading ? 'Researching...' : 'Ask CiteOS'}
      </button>

      {sources.length > 0 && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="font-bold text-sm text-gray-700 mb-2">Sources Referenced:</h3>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {sources.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer && (
        <div className="p-6 bg-white border border-gray-200 rounded-md shadow-sm whitespace-pre-wrap leading-relaxed text-gray-800">
          {answer}
        </div>
      )}
    </div>
  );
}