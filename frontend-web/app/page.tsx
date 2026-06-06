"use client";

import { useState } from "react";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setStatus("loading");

    try {
      const response = await fetch("http://localhost:5000/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicName: topic }),
      });

      if (!response.ok) throw new Error("Failed to save topic");

      setStatus("success");
      setMessage(`"${topic}" added successfully! The agentic loop will begin shortly.`);
      setTopic(""); 
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("Failed to connect to the CiteOS backend.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-20 px-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CiteOS Dashboard</h1>
        <p className="text-gray-500 mb-8">Enter a research topic to trigger the autonomous data pipeline.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., The evolution of solid-state batteries..."
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={status === "loading"}
          />
          <button
            type="submit"
            disabled={status === "loading" || !topic.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {status === "loading" ? "Initializing Pipeline..." : "Start Research"}
          </button>
        </form>

        {status === "success" && (
          <div className="mt-6 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
            {message}
          </div>
        )}
        
        {status === "error" && (
          <div className="mt-6 p-4 bg-red-50 text-red-800 rounded-lg border border-red-200">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}