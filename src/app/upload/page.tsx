import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { UploadForm } from '@/components/UploadForm';
import { DangerZone } from '@/components/DangerZone';
import { requireAuth } from '@/lib/redirects';
import { userHasPortfolioData } from '@/lib/auth';
import { getImportHistory } from '@/lib/portfolio-data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';

export default async function UploadPage() {
  const userId = await requireAuth();
  const hasData = await userHasPortfolioData(userId);
  const imports = hasData ? await getImportHistory(userId) : [];

  return (
    <div className="space-y-8">
      {!hasData ? (
        <PageHeader
          title="Get started"
          description="Upload your Zerodha tradebook CSV files to unlock the dashboard and holdings view."
        />
      ) : (
        <PageHeader
          title="Import data"
          description="Add more tradebook years or replace your portfolio with a fresh import."
          actions={
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Link>
          }
        />
      )}

      <UploadForm hasExistingData={hasData} />

      {imports.length > 0 && (
        <Card>
          <CardHeader title="Import history" />
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {imports.map((imp) => (
              <li
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="font-medium">{imp.fileName}</span>
                <span className="text-[var(--color-muted)]">
                  {imp.imported} trades ·{' '}
                  {new Date(imp.createdAt).toLocaleDateString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasData && <DangerZone />}
    </div>
  );
}
