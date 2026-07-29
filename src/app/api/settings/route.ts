import { NextResponse } from 'next/server';
import { requireValidUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendTelegram, notificationsConfigured } from '@/lib/notify';

/**
 * Account settings.
 *
 * Exists mainly so the Telegram chat id can be set. Without it, alerts were
 * configured everywhere except the one place a user could reach — the column
 * was there, the cron read it, and nothing on earth could write it short of a
 * hand-rolled SQL statement.
 */

export async function GET() {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, telegramChatId: true },
  });

  return NextResponse.json({
    success: true,
    email: row?.email,
    name: row?.name,
    telegramChatId: row?.telegramChatId ?? '',
    // Distinguishes "you have not set a chat id" from "the server has no bot
    // token" — they need different fixes and look identical otherwise.
    botConfigured: notificationsConfigured(),
  });
}

export async function PATCH(request: Request) {
  const user = await requireValidUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { telegramChatId, sendTest } = await request.json();

    if (telegramChatId !== undefined) {
      const id = String(telegramChatId ?? '').trim();
      // Telegram chat ids are numeric; negative for groups.
      if (id && !/^-?\d{5,20}$/.test(id)) {
        return NextResponse.json(
          { error: 'Chat id should be a number, e.g. 1428926513' },
          { status: 400 }
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: id || null },
      });

      if (id && sendTest) {
        if (!notificationsConfigured()) {
          return NextResponse.json({
            success: true,
            saved: true,
            testSent: false,
            testError: 'Saved, but TELEGRAM_BOT_TOKEN is not set on the server.',
          });
        }
        // Prove it works now rather than discovering at 3pm that it never did.
        const res = await sendTelegram(
          id,
          '✅ <b>Alerts are working</b>\n\nYou will get a message here when a holding hits its exit signal or stop loss.'
        );
        return NextResponse.json({
          success: true,
          saved: true,
          testSent: res.sent,
          ...(res.sent ? {} : { testError: res.reason }),
        });
      }
    }

    return NextResponse.json({ success: true, saved: true });
  } catch (e) {
    console.error('Settings update error:', e);
    return NextResponse.json({ error: 'Could not save settings' }, { status: 500 });
  }
}
