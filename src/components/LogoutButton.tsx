'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Activity } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    // Logout revokes every session server-side before redirecting, so it is a
    // real round trip. Unguarded, the button looks dead and invites a second
    // click mid-request.
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <Button
      variant="ghost" size="sm" onClick={handleLogout}
      disabled={busy} aria-busy={busy} aria-label="Sign out"
    >
      {busy ? <Activity className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span className="hidden sm:inline">{busy ? 'Signing out…' : 'Sign out'}</span>
    </Button>
  );
}
