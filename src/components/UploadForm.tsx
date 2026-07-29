"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

type FileResult = {
  fileName: string;
  imported: number;
  skipped: number;
  errors: string[];
};

type ImportResponse = {
  success?: boolean;
  files?: FileResult[];
  totalImported?: number;
  totalSkipped?: number;
  assets?: number;
  mergedRenames?: number;
  error?: string;
  details?: string[];
  sessionExpired?: boolean;
};

export function UploadForm({ hasExistingData, importType = 'STOCK' }: { hasExistingData: boolean; importType?: 'STOCK' | 'MUTUAL_FUND' | 'US_STOCK' }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [replace, setReplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  function addFiles(newFiles: FileList | File[]) {
    const csvFiles = Array.from(newFiles).filter((f) =>
      f.name.toLowerCase().endsWith('.csv')
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...csvFiles.filter((f) => !names.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (replace) formData.append('replace', 'true');
    formData.append('importType', importType);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data: ImportResponse = await res.json();

      if (res.status === 401 && data.sessionExpired) {
        router.push('/login');
        return;
      }

      setResult(data);

      if (res.ok && data.success && (data.totalImported ?? 0) > 0) {
        router.refresh();
        setTimeout(() => router.push('/'), 1200);
      }
    } catch {
      setResult({ error: 'Upload failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader
          title={
            importType === 'MUTUAL_FUND' 
              ? "Import Mutual Fund Tradebooks" 
              : importType === 'US_STOCK' 
              ? "Import US Stocks" 
              : "Import CSV files"
          }
          description={
            importType === 'MUTUAL_FUND' 
              ? "Upload your Mutual Fund CAS or tradebook exports." 
              : importType === 'US_STOCK'
              ? "Upload your US Stocks tradebook exports."
              : "Zerodha tradebook exports plus optional holdings file."
          }
        />

        <div
          className="rounded-xl border-2 border-dashed border-[var(--color-border-strong)] bg-slate-50/50 px-6 py-10 text-center transition-colors hover:border-teal-300 hover:bg-teal-50/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
          }}
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[var(--color-border)]">
            <Upload className="h-6 w-6 text-teal-600" />
          </div>
          <p className="font-medium text-[var(--color-foreground)]">
            Drop CSV files here
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Tradebooks and holdings.csv · multiple files OK
          </p>
          <label className="mt-5 inline-block cursor-pointer">
            <span className="inline-flex h-10 items-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              Browse files
            </span>
            <input
              type="file"
              accept=".csv"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {files.length > 0 && (
          <ul className="mt-5 space-y-2">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5"
              >
                <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(file.name)}
                  className="rounded-md p-1 text-[var(--color-muted)] hover:bg-slate-100 hover:text-[var(--color-danger)]"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasExistingData && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Replace all existing data (fresh import)
          </label>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="submit"
            variant="accent"
            disabled={files.length === 0 || loading}
          >
            {loading && <Activity className="h-4 w-4 animate-spin mr-2 inline" />}
            {loading
              ? `Importing ${files.length} file${files.length > 1 ? 's' : ''}…`
              : `Import ${files.length || 0} file${files.length !== 1 ? 's' : ''}`}
          </Button>
          <a
            href="/samples/sample01.csv"
            download
            className="inline-flex h-10 items-center rounded-lg border border-[var(--color-border-strong)] bg-white px-4 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            Sample CSV
          </a>
        </div>
      </Card>

      <Card padding="default">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-[var(--color-foreground)]"
        >
          How to export from Zerodha
          {showHelp ? (
            <ChevronUp className="h-4 w-4 text-[var(--color-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--color-muted)]" />
          )}
        </button>
        {showHelp && (
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-muted)]">
            <li>Console → Reports → Tradebook → Export CSV (one file per year).</li>
            <li>
              Optional: Reports → Holdings → Export as holdings.csv (filename must
              contain &quot;holding&quot;) for LTP and quantity alignment.
            </li>
            <li>Bonuses and splits are applied from NSE data on the ex-date.</li>
            <li>Symbol renames are merged by ISIN automatically.</li>
          </ol>
        )}
      </Card>

      {result && (
        <div>
          {result.success ? (
            <Alert tone="success" title="Import complete">
              <p>
                {result.totalImported} trades imported
                {result.totalSkipped
                  ? ` · ${result.totalSkipped} duplicates skipped`
                  : ''}{' '}
                · {result.assets} assets
              </p>
              {result.files?.map((f) => (
                <p key={f.fileName} className="mt-1 text-xs opacity-90">
                  {f.fileName}: {f.imported} new, {f.skipped} skipped
                </p>
              ))}
              {(result.totalImported ?? 0) > 0 && (
                <p className="mt-2 text-xs">Redirecting to dashboard…</p>
              )}
            </Alert>
          ) : (
            <Alert tone="error" title={result.error ?? 'Import failed'}>
              {(result.details ?? []).map((msg, i) => (
                <p key={i} className="mt-1">
                  {msg}
                </p>
              ))}
            </Alert>
          )}
        </div>
      )}
    </form>
  );
}
