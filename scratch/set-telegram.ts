/**
 * Attach a Telegram chat id to a user. Run after registering.
 *   npx tsx scratch/set-telegram.ts you@example.com 1428926513
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const [email, chatId] = process.argv.slice(2);
(async () => {
  if (!email || !chatId) { console.error('usage: set-telegram.ts <email> <chatId>'); process.exit(1); }
  const p = new PrismaClient();
  const u = await p.user.update({ where: { email }, data: { telegramChatId: chatId } });
  console.log(`alerts for ${u.email} -> chat ${chatId}`);
  await p.$disconnect();
})();
