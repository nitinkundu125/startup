import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/session';

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

/** Returns user only if session exists and user row is in DB. Does not modify cookies (safe in Server Components). */
export async function requireValidUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}

export async function userHasPortfolioData(userId: string): Promise<boolean> {
  const count = await prisma.transaction.count({ where: { userId } });
  return count > 0;
}
