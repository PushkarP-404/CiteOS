"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthToken } from '@/lib/auth';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isLogin) {
        setAuthToken(data.access_token);
        router.push('/');
      } else {
        // Auto login after register
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          setAuthToken(loginData.access_token);
          router.push('/');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen flex items-center justify-center bg-transparent relative overflow-hidden">
      {/* CiteOS Background Logo */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 font-handwriting text-6xl font-bold text-[var(--foreground)] opacity-90 select-none pointer-events-none z-0">
        Cite<span className="text-orange-500">OS</span>
      </div>

      <div className="w-full max-w-md p-8 bg-[var(--background)] rounded-lg shadow-sm border-2 border-dashed border-[var(--margin-line)] z-10 transform rotate-1">
        <h2 className="text-4xl font-handwriting font-bold mb-6 text-center text-[var(--foreground)] underline decoration-wavy decoration-blue-500">
          {isLogin ? 'Welcome Back' : 'Join CiteOS'}
        </h2>

        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded font-sans">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xl font-handwriting text-[var(--foreground)] mb-2" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-transparent border-b-2 border-dashed border-[var(--foreground)] focus:border-blue-500 focus:outline-none font-handwriting text-2xl text-[var(--foreground)]"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xl font-handwriting text-[var(--foreground)] mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-transparent border-b-2 border-dashed border-[var(--foreground)] focus:border-blue-500 focus:outline-none font-sans text-2xl caret-[var(--foreground)] leading-normal text-[var(--foreground)]"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username || !password}
            className="w-full py-3 px-4 font-handwriting text-3xl font-bold bg-[var(--line-color)] border-2 border-[var(--margin-line)] text-[var(--foreground)] hover:bg-orange-200 dark:hover:bg-orange-900 transition-colors disabled:opacity-50"
          >
            {isLoading ? '...' : isLogin ? 'Log In ➔' : 'Sign Up ➔'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-lg font-handwriting text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            {isLogin ? 'Need an account? Sign up' : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </main>
  );
}
