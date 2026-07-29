/**
 * Signal alerts over Telegram.
 *
 * A signal you have to open the app to discover is not an alert. The exit
 * condition can fire on Tuesday and go unseen until Friday, by which point the
 * trade the app was tracking bears no resemblance to the one you are in.
 *
 * Telegram rather than email because it needs no SMTP server, no deliverability
 * work and no new dependency — one fetch against the bot API. The token is
 * app-level (TELEGRAM_BOT_TOKEN); the destination chat is per-user, so a missing
 * chat id disables alerts for that user rather than failing.
 *
 * Setup:
 *   1. Message @BotFather on Telegram, /newbot, copy the token
 *   2. TELEGRAM_BOT_TOKEN=... in .env
 *   3. Message your new bot once, then open
 *      https://api.telegram.org/bot<TOKEN>/getUpdates to read your chat id
 *   4. Save that id against the user
 */

import { displayStock } from './stock-names';

export type NotifyResult = { sent: boolean; reason?: string };

const TELEGRAM_API = 'https://api.telegram.org';

export function notificationsConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/**
 * Send one message. Never throws — a failed alert must not take down the cron
 * that produced it, or one bad chat id stops every other user's alerts too.
 */
export async function sendTelegram(chatId: string, text: string): Promise<NotifyResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { sent: false, reason: 'TELEGRAM_BOT_TOKEN not set' };
  if (!chatId?.trim()) return { sent: false, reason: 'no chat id for user' };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { sent: false, reason: `Telegram ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export type SignalAlert = {
  symbol: string;
  /** Company name, when known. Alerts read better as a name than a ticker. */
  companyName?: string | null;
  strategyName: string;
  signal: 'NEW_BUY' | 'NEW_SELL' | 'HOLDING' | 'WAITING';
  /** Held-back stats — the honest ones, not the fitted figures. */
  oosWinRate?: number;
  oosTotalTrades?: number;
  avgHoldingDays?: number;
  /** Plain-English exit rule, so a BUY says what you are waiting for. */
  exitRule?: string;
  price?: number;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Alert text.
 *
 * A BUY carries its exit rule, because the most common failure mode is buying a
 * signal with no idea what ends the trade. Stats quoted are out-of-sample; the
 * fitted numbers were selected on and would overstate the case.
 */
export function formatSignalAlert(a: SignalAlert): string {
  const head =
    a.signal === 'NEW_BUY' ? '🟢 <b>BUY SIGNAL</b>'
    : a.signal === 'NEW_SELL' ? '🔴 <b>SELL SIGNAL</b>'
    : `<b>${a.signal}</b>`;

  const lines = [
    head,
    '',
    `<b>${escapeHtml(displayStock(a.symbol, a.companyName))}</b>`,
    `Strategy: ${escapeHtml(a.strategyName)}`,
  ];

  if (a.price != null) lines.push(`Price: ₹${a.price.toFixed(2)}`);

  if (a.signal === 'NEW_BUY') {
    if (a.exitRule) lines.push('', `<b>Exit when:</b> ${escapeHtml(a.exitRule)}`);
    if (a.avgHoldingDays != null) {
      lines.push(`Typically held ~${Math.round(a.avgHoldingDays)} days`);
    }
  }

  if (a.oosTotalTrades && a.oosTotalTrades > 0 && a.oosWinRate != null) {
    lines.push(
      '',
      `Out-of-sample: ${a.oosWinRate.toFixed(0)}% win rate over ${a.oosTotalTrades} trades`
    );
  } else {
    lines.push('', '<i>Not validated out-of-sample — treat with caution.</i>');
  }

  lines.push('', '<i>Backtest signal, not advice. Costs are modelled; slippage and taxes are not.</i>');
  return lines.join('\n');
}
