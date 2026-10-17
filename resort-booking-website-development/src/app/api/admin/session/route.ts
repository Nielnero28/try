import { NextRequest, NextResponse } from 'next/server';
import {
  adminConfigured, adminCookie, clearLoginFailures, createAdminSession, isAdminRequest,
  isTrustedAdminOrigin, loginFingerprint, loginRateLimited, markLoginFailed,
  revokeAdminSession, sessionDurationSeconds, validateStaffCredentials,
} from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
const respond = (body: object, status = 200) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store' },
});

export async function GET(request: NextRequest) {
  try {
    if (!await isAdminRequest(request)) return respond({ authenticated: false }, 401);
    return respond({ authenticated: true, role: 'admin' });
  } catch {
    return respond({ error: 'Unable to check your staff session.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedAdminOrigin(request)) return respond({ error: 'Request origin not allowed.' }, 403);
  try {
    if (!await adminConfigured()) return respond({ error: 'Staff access has not been configured.' }, 503);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('email' in body) || !('password' in body)) {
      return respond({ error: 'Enter your staff email and password.' }, 400);
    }
    const { email, password, transport } = body as { email: unknown; password: unknown; transport?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 255 || password.length > 1024) {
      return respond({ error: 'Invalid email or password.' }, 401);
    }
    const fingerprint = loginFingerprint(email, request);
    if (await loginRateLimited(fingerprint)) return respond({ error: 'Too many sign-in attempts. Please try again in 15 minutes.' }, 429);
    const user = await validateStaffCredentials(email, password);
    if (!user) {
      await markLoginFailed(fingerprint);
      return respond({ error: 'Invalid email or password.' }, 401);
    }
    await clearLoginFailures(fingerprint);
    const token = await createAdminSession(user.id);
    if (transport === 'bearer') {
      // Used only if a privacy-restricted embedded browser cannot send cookies.
      return respond({ success: true, role: 'admin', sessionToken: token, expiresIn: sessionDurationSeconds });
    }
    const response = respond({ success: true, role: 'admin' });
    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(adminCookie, token, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      partitioned: secure,
      path: '/',
      maxAge: sessionDurationSeconds,
    });
    return response;
  } catch {
    return respond({ error: 'Unable to sign in right now. Please try again.' }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedAdminOrigin(request)) return respond({ error: 'Request origin not allowed.' }, 403);
  try {
    await revokeAdminSession(request);
    const response = respond({ success: true });
    const secure = process.env.NODE_ENV === 'production';
    response.cookies.set(adminCookie, '', {
      httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', partitioned: secure,
      path: '/', maxAge: 0,
    });
    return response;
  } catch {
    return respond({ error: 'Unable to sign out right now.' }, 503);
  }
}
