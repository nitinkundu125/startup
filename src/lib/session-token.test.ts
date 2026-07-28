import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// getSecret() is read lazily at sign time, not at import time, so setting this
// before any test body runs is enough.
process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-to-be-realistic-000000';

import { createSessionToken, verifySessionToken, verifySessionTokenFull } from './session-token.ts';
import { constantTimeEquals } from './cron-auth.ts';

/**
 * Mirrors the revocation check in requireValidUser() without needing a database.
 * A token is dead if it was minted before the user's cut-off, or if it carries
 * no issued-at at all (pre-revocation token, too old to trust).
 */
function isRevoked(issuedAt: number | null, sessionsValidFrom: Date | null): boolean {
  if (!sessionsValidFrom) return false;
  if (issuedAt === null) return true;
  return issuedAt < sessionsValidFrom.getTime();
}

describe('session tokens', () => {
  it('round-trips a userId', async () => {
    const token = await createSessionToken('user-1');
    assert.equal(await verifySessionToken(token), 'user-1');
  });

  it('records an issued-at', async () => {
    const before = Date.now();
    const token = await createSessionToken('user-1');
    const session = await verifySessionTokenFull(token);
    assert.ok(session);
    assert.ok(session!.issuedAt !== null);
    assert.ok(session!.issuedAt! >= before);
  });

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken('user-1');
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ userId: 'admin', exp: Date.now() + 1e6 }))
      .toString('base64url');
    assert.equal(await verifySessionToken(`${forged}.${sig}`), null);
  });

  it('rejects a tampered signature', async () => {
    const token = await createSessionToken('user-1');
    const [encoded] = token.split('.');
    assert.equal(await verifySessionToken(`${encoded}.not-the-signature`), null);
  });

  it('rejects a malformed token', async () => {
    assert.equal(await verifySessionToken('garbage'), null);
    assert.equal(await verifySessionToken(''), null);
  });
});

describe('session revocation', () => {
  it('accepts a token minted after the cut-off', async () => {
    const cutoff = new Date(Date.now() - 10_000);
    const token = await createSessionToken('user-1');
    const session = await verifySessionTokenFull(token);
    assert.equal(isRevoked(session!.issuedAt, cutoff), false);
  });

  it('rejects a token minted before the cut-off', async () => {
    // The stolen-cookie case: logout bumps the cut-off past the token's iat.
    const token = await createSessionToken('user-1');
    const session = await verifySessionTokenFull(token);
    const cutoff = new Date(session!.issuedAt! + 1);
    assert.equal(isRevoked(session!.issuedAt, cutoff), true);
  });

  it('rejects legacy tokens that carry no issued-at', () => {
    assert.equal(isRevoked(null, new Date()), true);
  });

  it('keeps a token minted in the same millisecond as the revocation', async () => {
    // changePassword revokes then immediately re-issues; the two land in the
    // same millisecond routinely. A `<=` comparison here would log the user out
    // of the very tab they changed their password in.
    const token = await createSessionToken('user-1');
    const session = await verifySessionTokenFull(token);
    const cutoff = new Date(session!.issuedAt!);
    assert.equal(isRevoked(session!.issuedAt, cutoff), false);
  });

  it('leaves users who never revoked unaffected', () => {
    assert.equal(isRevoked(Date.now(), null), false);
    assert.equal(isRevoked(null, null), false);
  });
});

describe('constantTimeEquals', () => {
  it('matches identical strings', () => {
    assert.equal(constantTimeEquals('abc123', 'abc123'), true);
  });

  it('rejects different content and different lengths', () => {
    assert.equal(constantTimeEquals('abc123', 'abc124'), false);
    assert.equal(constantTimeEquals('abc', 'abcdef'), false);
    assert.equal(constantTimeEquals('', 'a'), false);
    assert.equal(constantTimeEquals('', ''), true);
  });
});
