"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'login'
        ? { email, password }
        : { email, password, name: name || undefined };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      router.push('/upload');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-white text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-muted)]'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
          }}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-white text-[var(--color-foreground)] shadow-sm'
              : 'text-[var(--color-muted)]'
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <Input
            id="name"
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        )}

        <Input
          id="email"
          type="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <Input
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
          minLength={6}
        />

        {error && <Alert tone="error">{error}</Alert>}

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </Card>
  );
}
