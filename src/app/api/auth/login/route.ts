import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await loginUser(email, password);
    await setSessionCookie(user.id);

    return NextResponse.json({ success: true, user });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
