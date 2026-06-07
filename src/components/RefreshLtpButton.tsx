'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type LtpRefreshResult = {
  fetchedAt: string;
  prices: Record<string, number>;
  failed: string[];
  updated: number;
  usdInr?: number;
};

type LtpResponse = {
  success?: boolean;
  fetchedAt?: string;
  prices?: Record<string, number>;
  updated?: number;
  failed?: string[];
  error?: string;
  sessionExpired?: boolean;
  usdInr?: number;
};

export function RefreshLtpButton({
  lastFetchedAt,
  failedCount = 0,
  onSuccess,
}: {
  lastFetchedAt?: string | null;
  failedCount?: number;
  onSuccess?: (result: LtpRefreshResult) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/portfolio/ltp', { method: 'POST' });
      const data: LtpResponse = await res.json();

      if (res.status === 401 && data.sessionExpired) {
        router.push('/login');
        return;
      }

      if (!res.ok || !data.prices) {
        setError(data.error ?? 'Failed to refresh prices');
        return;
      }

      const result: LtpRefreshResult = {
        fetchedAt: data.fetchedAt ?? new Date().toISOString(),
        prices: data.prices,
        failed: data.failed ?? [],
        updated: data.updated ?? Object.keys(data.prices).length,
        usdInr: data.usdInr,
      };

      onSuccess?.(result);

      const time = new Date(result.fetchedAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      let msg = `Updated ${result.updated} symbols · ${time}`;
      if (result.failed.length) {
        msg += ` · ${result.failed.length} unavailable`;
      }
      setMessage(msg);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const staleLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        size="md"
        onClick={handleRefresh}
        disabled={loading}
        title="Fetch latest prices from NSE (Yahoo fallback)"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Fetching LTP…' : 'Refresh live prices'}
      </Button>
      {loading && (
        <span className="text-xs text-[var(--color-muted)]">
          Usually 5–15s for a full portfolio…
        </span>
      )}
      {staleLabel && !message && !error && !loading && (
        <span className="text-xs text-[var(--color-muted)]">
          Last live: {staleLabel}
          {failedCount > 0 ? ` · ${failedCount} failed` : ''}
        </span>
      )}
      {message && !loading && (
        <span className="text-xs text-[var(--color-success)]">{message}</span>
      )}
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  );
}
