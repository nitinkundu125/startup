type SessionPayload = {
  userId: string;
  exp: number;
};

function getSecret(): string {
  return process.env.AUTH_SECRET ?? 'dev-secret-change-in-production';
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
    if (sig !== expected) return null;
    const payload = JSON.parse(decodeBase64Url(encoded)) as SessionPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
