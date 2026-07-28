import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/session-token';

const PUBLIC_PATHS = ['/login', '/mf'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/samples') ||
    pathname.endsWith('.svg') ||
    pathname.startsWith('/api/auth') ||
    // Cron endpoints authenticate themselves (CRON_SECRET header OR a session)
    // and return 401 on failure. Without this they were redirected to /login
    // before the handler ever ran, so a scheduler could never reach them — the
    // shared-secret support was unreachable.
    pathname.startsWith('/api/cron/')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId) {
    if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/mf')) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
