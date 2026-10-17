// The normal staff session is an HTTP-only cookie. The tab-scoped bearer token
// is used only when an embedded browser refuses to send that cookie.
const storageKey = 'painawa_staff_tab_session_v1';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
let memorySession: { token: string; expiresAt: number } | null = null;

export function clearStaffTabSession() {
  memorySession = null;
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.removeItem(storageKey); } catch { /* Private storage may be disabled. */ }
  }
}

export function getStaffTabToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (!memorySession) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) memorySession = JSON.parse(stored);
    } catch { return null; }
  }
  if (!memorySession || !tokenPattern.test(memorySession.token) ||
    !Number.isFinite(memorySession.expiresAt) || memorySession.expiresAt <= Date.now()) {
    clearStaffTabSession();
    return null;
  }
  return memorySession.token;
}

export function rememberStaffTabSession(token: string, expiresIn: number) {
  if (!tokenPattern.test(token)) throw new Error('Invalid staff session response.');
  memorySession = { token, expiresAt: Date.now() + Math.min(Math.max(expiresIn || 0, 60), 8 * 60 * 60) * 1000 };
  try { window.sessionStorage.setItem(storageKey, JSON.stringify(memorySession)); }
  catch { /* Memory-only fallback still works until the tab reloads. */ }
}

export async function staffFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getStaffTabToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const options: RequestInit = { ...init, headers, credentials: 'include', cache: 'no-store' };
  let response = await fetch(input, options);
  if (response.status === 401 && token) {
    // If an old tab token was rotated, give a valid first-party cookie a chance.
    clearStaffTabSession();
    headers.delete('Authorization');
    response = await fetch(input, { ...options, headers });
  }
  return response;
}
