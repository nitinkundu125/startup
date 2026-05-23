import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { setSessionCookie } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await registerUser(email, password, name);
    await setSessionCookie(user.id);

    return NextResponse.json({ success: true, user });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
