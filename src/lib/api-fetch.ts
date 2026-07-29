/**
 * fetch() that notices when the session has gone.
 *
 * The middleware used to redirect unauthenticated API calls to /login. A fetch
 * followed that redirect, got HTML, res.json() threw, and every caller's catch
 * swallowed it — leaving the user looking at stale numbers with no indication
 * anything was wrong. The middleware now returns 401; this makes sure something
 * happens when it does.
 */

let redirecting = false;

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401 && typeof window !== 'undefined' && !redirecting) {
    // Guard: several panels fetch in parallel and would each fire a navigation.
    redirecting = true;
    const from = window.location.pathname + window.location.search;
    window.location.href = `/login?from=${encodeURIComponent(from)}&expired=1`;
  }

  return res;
}

/**
 * apiFetch + JSON parse, returning null instead of throwing.
 *
 * Callers that only want the payload should not have to write the same
 * try/catch, and a swallowed parse error is exactly how the silent-failure bug
 * hid in the first place.
 */
export async function apiJson<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await apiFetch(input, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
