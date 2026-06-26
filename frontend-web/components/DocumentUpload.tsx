"use client";

import { useState, useRef } from 'react';

interface DocumentUploadProps {
  topicId: string;
}

export default function DocumentUpload({ topicId }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setStatus({ type: 'error', message: 'Only PDF files are supported.' });
      return;
    }

    setIsUploading(true);
    setStatus({ type: '', message: '' });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('topicId', topicId);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: `Successfully uploaded and processed ${data.chunks_processed} chunks.` });
      } else {
        setStatus({ type: 'error', message: data.detail || data.message || 'Upload failed.' });
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatus({ type: 'error', message: 'Failed to connect to the server.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full bg-white p-4 border border-gray-200 rounded-md shadow-sm">
      <div className="flex flex-col space-y-3">
        <label className="text-sm font-semibold text-gray-800">Upload Research Document</label>
        <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              ref={fileInputRef}
              disabled={isUploading || !topicId}
              className="block w-full text-sm text-gray-600
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100 disabled:opacity-50 transition-colors"
            />
            {isUploading && <span className="text-sm font-medium text-blue-600 animate-pulse">Uploading...</span>}
        </div>
        
        {status.message && (
          <p className={`text-sm mt-1 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
