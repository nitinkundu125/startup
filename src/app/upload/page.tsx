import Link from 'next/link';
import { BarChart3, ArrowRight } from 'lucide-react';
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
          title="Add Assets"
          description="Upload your tradebook or CAS data to get started. You can also skip this and explore the dashboard first."
          actions={
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white border border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-foreground)] shadow-sm hover:bg-slate-50"
            >
              Skip to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <PageHeader
          title="Import data"
          description="Add more data or replace your portfolio with a fresh import."
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:items-start">
        <UploadForm hasExistingData={hasData} importType="STOCK" />
        <UploadForm hasExistingData={hasData} importType="MUTUAL_FUND" />
        <UploadForm hasExistingData={hasData} importType="US_STOCK" />
      </div>

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
