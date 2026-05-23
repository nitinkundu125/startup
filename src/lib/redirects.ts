import { redirect } from 'next/navigation';
import { requireValidUser, userHasPortfolioData } from '@/lib/auth';

export async function requireAuth() {
  const user = await requireValidUser();
  if (!user) redirect('/login');
  return user.id;
}

export async function requirePortfolioData() {
  const userId = await requireAuth();
  const hasData = await userHasPortfolioData(userId);
  if (!hasData) redirect('/upload');
  return userId;
}

export async function redirectIfHasData() {
  const user = await requireValidUser();
  if (!user) return;
  const hasData = await userHasPortfolioData(user.id);
  if (hasData) redirect('/');
}
