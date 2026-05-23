import { AuthForm } from '@/components/AuthForm';
import { redirectIfHasData } from '@/lib/redirects';
import { requireValidUser } from '@/lib/auth';
import { getSessionUserId } from '@/lib/session';
import { BarChart3 } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';

export default async function LoginPage() {
  await redirectIfHasData();

  const hasToken = await getSessionUserId();
  const user = await requireValidUser();
  const staleSession = !!hasToken && !user;

  return (
    <div className="mx-auto max-w-lg py-8 md:py-16">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Sign in to import Zerodha tradebooks and track FIFO holdings.
        </p>
      </div>

      {staleSession && (
        <div className="mb-6">
          <Alert tone="warning" title="Session expired">
            Please sign in again to continue.
          </Alert>
        </div>
      )}

      <AuthForm />
    </div>
  );
}
