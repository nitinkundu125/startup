import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSessionUserId, getVerifiedSession } from '@/lib/session';

export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ id: string; email: string; name: string | null }> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    throw new Error('Email already registered');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      name: name?.trim() || null,
    },
  });

  return { id: user.id, email: user.email, name: user.name };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  return { id: user.id, email: user.email, name: user.name };
}

export async function requireUser() {
  return requireValidUser();
}

/**
 * Returns the user only if the session is valid, the user row exists, and the
 * session has not been revoked. Does not modify cookies (safe in Server
 * Components).
 *
 * This is where revocation is enforced. The edge middleware can only verify the
 * signature — it has no database — so a stolen cookie gets past the middleware
 * and is rejected here. Every page and route handler goes through this.
 */
export async function requireValidUser() {
  const session = await getVerifiedSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, sessionsValidFrom: true },
  });
  if (!user) return null;

  if (user.sessionsValidFrom) {
    // Tokens minted before the cut-off are dead. A token with no issued-at
    // predates revocation support, so it is treated as too old to trust.
    const issuedAt = session.issuedAt;
    if (issuedAt === null || issuedAt < user.sessionsValidFrom.getTime()) {
      return null;
    }
  }

  return { id: user.id, email: user.email, name: user.name };
}

/**
 * Invalidate every session for a user, including cookies already stolen.
 * Called on logout; also call this after a password change.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    // +1ms so a token minted in the same millisecond as the revocation is also
    // rejected, rather than surviving on a >= comparison.
    data: { sessionsValidFrom: new Date(Date.now() + 1) },
  });
}

export async function userHasPortfolioData(userId: string): Promise<boolean> {
  const count = await prisma.transaction.count({ where: { userId } });
  return count > 0;
}
