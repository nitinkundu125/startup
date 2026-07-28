import { constantTimeEquals } from '@/lib/cron-auth';

type SessionPayload = {
  userId: string;
  exp: number;
};

const DEV_FALLBACK_SECRET = 'dev-secret-change-in-production';

/** Values that are published somewhere and must never sign a real session. */
const KNOWN_PLACEHOLDERS = new Set([
  DEV_FALLBACK_SECRET,
  'change-me-in-production',
  'changeme',
  'secret',
]);

/**
 * Session signing key.
 *
 * This used to silently fall back to a constant that is committed in this file,
 * which meant a missing AUTH_SECRET in any environment was a full authentication
 * bypass — anyone could forge `base64url({userId, exp}).hmac` for any account.
 * Outside development it now refuses to sign rather than signing with a key an
 * attacker can read off GitHub.
 */
function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || KNOWN_PLACEHOLDERS.has(secret)) {
    if (isProd) {
      throw new Error(
        'AUTH_SECRET is missing or set to a known placeholder. Refusing to sign ' +
          'sessions with a publicly known key. Set AUTH_SECRET to a random value ' +
          '(e.g. `openssl rand -base64 48`).'
      );
    }
    return DEV_FALLBACK_SECRET;
  }

  if (isProd && secret.length < 32) {
    console.warn(
      `AUTH_SECRET is only ${secret.length} characters. Use at least 32 for a signing key.`
    );
  }

  return secret;
}

function encodeBase64Url(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'utf8').toString('base64url');
  }
  const bytes = new TextEncoder().encode(data);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(encoded: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64url').toString('utf8');
  }
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSessionToken(userId: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const sig = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = await hmacSign(encoded);
    // Constant-time compare so signature verification does not leak via timing.
    if (!constantTimeEquals(sig, expected)) return null;
    const payload = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
