'use client';

import { useEffect, useState } from 'react';
import { Bell, KeyRound, Loader2, Check } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api-fetch';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Settings = {
  email: string;
  telegramChatId: string;
  botConfigured: boolean;
};

export function SettingsClient() {
  const [chatId, setChatId] = useState('');
  const [botConfigured, setBotConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changing, setChanging] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    apiJson<Settings>('/api/settings').then((data) => {
      if (!alive || !data) return;
      setChatId(data.telegramChatId ?? '');
      setBotConfigured(data.botConfigured);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function saveAlerts(sendTest: boolean) {
    setSaving(true);
    setAlertMsg(null);
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: chatId, sendTest }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setAlertMsg({ ok: false, text: data?.error ?? 'Could not save' });
    } else if (sendTest) {
      setAlertMsg(
        data.testSent
          ? { ok: true, text: 'Saved. Check Telegram — a test message is on its way.' }
          : { ok: false, text: `Saved, but the test message failed: ${data.testError ?? 'unknown error'}` }
      );
    } else {
      setAlertMsg({ ok: true, text: chatId ? 'Saved.' : 'Alerts turned off.' });
    }
    setSaving(false);
  }

  async function changePassword() {
    if (next !== confirm) {
      setPwMsg({ ok: false, text: 'The two new passwords do not match.' });
      return;
    }
    setChanging(true);
    setPwMsg(null);
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPwMsg({ ok: true, text: 'Password changed. Every other signed-in device was logged out.' });
      setCurrent(''); setNext(''); setConfirm('');
    } else {
      setPwMsg({ ok: false, text: data?.error ?? 'Could not change the password' });
    }
    setChanging(false);
  }

  const note = (m: { ok: boolean; text: string } | null) =>
    m && (
      <p className={`text-sm ${m.ok ? 'text-teal-700' : 'text-red-600'}`}>
        {m.ok && <Check className="mr-1 inline h-4 w-4" />}
        {m.text}
      </p>
    );

  return (
    <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <Card>
        <CardHeader
          title="Exit alerts"
          description="When a holding hits its sell signal or stop loss, the daily check messages you on Telegram."
        />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              id="chatId"
              label="Telegram chat id"
              value={chatId}
              inputMode="numeric"
              placeholder="e.g. 1428926513"
              onChange={(e) => setChatId(e.target.value)}
            />
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              Message <strong>@userinfobot</strong> on Telegram — it replies with your id. Then
              send any message to your alerts bot once, so it is allowed to write to you.
              Leave this blank to switch alerts off.
            </p>
            {!botConfigured && (
              <p className="text-xs text-[var(--color-muted)]">
                The server has no <code>TELEGRAM_BOT_TOKEN</code> set, so nothing will send yet.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveAlerts(true)} disabled={saving || !chatId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Save &amp; send test
              </Button>
              <Button variant="secondary" onClick={() => saveAlerts(false)} disabled={saving}>
                Save only
              </Button>
            </div>
            {note(alertMsg)}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Password" description="Changing it signs out every other device." />
        <div className="space-y-4">
          <Input
            id="current" label="Current password" type="password" autoComplete="current-password"
            value={current} onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            id="next" label="New password" type="password" autoComplete="new-password"
            value={next} onChange={(e) => setNext(e.target.value)}
          />
          <Input
            id="confirm" label="Confirm new password" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
          />
          <Button onClick={changePassword} disabled={changing || !current || !next || !confirm}>
            {changing ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Change password
          </Button>
          {note(pwMsg)}
        </div>
      </Card>
    </div>
  );
}
