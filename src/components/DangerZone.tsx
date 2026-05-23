import { ClearDataButton } from '@/components/ClearDataButton';
import { Card, CardHeader } from '@/components/ui/Card';

export function DangerZone() {
  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader
        title="Erase portfolio data"
        description="Removes all trades, holdings, and import history. Your account login is kept."
      />
      <ClearDataButton />
    </Card>
  );
}
