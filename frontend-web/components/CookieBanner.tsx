"use client";

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasConsented = localStorage.getItem('citeos_cookie_consent');
    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('citeos_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs md:max-w-sm p-4 bg-[var(--background)] border-2 border-[var(--margin-line)] shadow-lg rounded font-sans">
      <p className="text-sm text-[var(--foreground)] mb-3 leading-relaxed">
        We use essential cookies to ensure this application functions correctly and to save your preferences. 
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={handleAccept}
          className="px-4 py-1.5 font-handwriting text-base font-bold bg-[var(--line-color)] border border-[var(--margin-line)] text-[var(--foreground)] hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors rounded transform rotate-1 hover:rotate-0"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
