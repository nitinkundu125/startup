import { requireAuth } from '@/lib/redirects';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  await requireAuth();

  return (
    <div>
      <PageHeader title="Settings" description="Alerts and account." />
      <SettingsClient />
    </div>
  );
}
