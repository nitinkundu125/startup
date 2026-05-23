"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

export function ClearDataButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClear() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portfolio/clear', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to erase data');
        setLoading(false);
        return;
      }

      setConfirming(false);
      router.refresh();
      router.push('/upload');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="md" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" />
        Erase all data
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-white p-4">
      <p className="font-medium text-[var(--color-foreground)]">
        Erase all portfolio data?
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        This cannot be undone. You can upload tradebooks again afterward.
      </p>
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="danger" onClick={handleClear} disabled={loading}>
          {loading ? 'Erasing…' : 'Yes, erase everything'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setConfirming(false);
            setError('');
          }}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
