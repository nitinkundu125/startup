/**
 * Shared-secret auth for scheduler-invoked endpoints.
 *
 * The cron routes previously required a browser session, so nothing could
 * actually call them on a schedule. A scheduler presents `CRON_SECRET` instead,
 * either as `Authorization: Bearer <secret>` or `X-Cron-Secret: <secret>`.
 *
 * When CRON_SECRET is unset, cron access is disabled entirely rather than
 * falling open.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get('authorization') ?? request.headers.get('x-cron-secret') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!provided) return false;

  return constantTimeEquals(provided, secret);
}

/** Length-independent, content-constant-time string comparison. */
export function constantTimeEquals(a: string, b: string): boolean {
  // Comparing lengths first would leak length, so fold it into the result
  // instead of returning early.
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
