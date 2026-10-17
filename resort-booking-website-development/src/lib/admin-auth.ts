import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { and, count, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { adminLoginAttempts, adminSessions, adminUsers } from '@/db/schema';

export const adminCookie = 'painawa_staff_session_v2';
export const sessionDurationSeconds = 60 * 60 * 8;
const attemptWindowMs = 15 * 60 * 1000;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function legacyAccountConfigured() {
  return Boolean(process.env.ADMIN_EMAIL && (process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD));
}

// An existing database account survives app rebuilds and .env resets.
export async function adminConfigured() {
  const [account] = await db.select({ id: adminUsers.id }).from(adminUsers)
    .where(and(eq(adminUsers.active, true), eq(adminUsers.role, 'admin'))).limit(1);
  return Boolean(account || legacyAccountConfigured());
}

export async function validateStaffCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 255 || password.length > 1024 || !normalizedEmail || !password) return null;
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalizedEmail)).limit(1);
  if (user) {
    if (!user.active || user.role !== 'admin' || !(await compare(password, user.passwordHash))) return null;
    return user;
  }

  // One-time migration for deployments already using the original environment-based owner.
  if (!legacyAccountConfigured()) return null;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const emailMatches = timingSafeEqual(digest(normalizedEmail), digest(process.env.ADMIN_EMAIL!.trim().toLowerCase()));
  if (!emailMatches) return null;
  const encodedHash = process.env.ADMIN_PASSWORD_HASH;
  const passwordMatches = encodedHash
    ? await compare(password, Buffer.from(encodedHash, 'base64url').toString('utf8'))
    : timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD!));
  if (!passwordMatches) return null;
  const passwordHash = encodedHash ? Buffer.from(encodedHash, 'base64url').toString('utf8') : await hash(password, 12);
  const [created] = await db.insert(adminUsers).values({ email: normalizedEmail, passwordHash, role: 'admin' })
    .onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalizedEmail)).limit(1);
  return existing?.active && existing.role === 'admin' && await compare(password, existing.passwordHash) ? existing : null;
}

export async function createAdminSession(adminId: number) {
  const token = randomBytes(32).toString('base64url');
  await db.insert(adminSessions).values({
    tokenHash: tokenHash(token),
    adminId,
    expiresAt: new Date(Date.now() + sessionDurationSeconds * 1000),
  });
  return token;
}

async function isValidToken(token: string | undefined) {
  if (!token || !tokenPattern.test(token)) return false;
  const [session] = await db.select({ id: adminUsers.id }).from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
    .where(and(
      eq(adminSessions.tokenHash, tokenHash(token)),
      gt(adminSessions.expiresAt, new Date()),
      eq(adminUsers.active, true),
      eq(adminUsers.role, 'admin'),
    )).limit(1);
  return Boolean(session);
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : undefined;
}

export async function isAdminRequest(request: NextRequest) {
  const bearer = bearerToken(request);
  if (bearer && await isValidToken(bearer)) return true;
  return isValidToken(request.cookies.get(adminCookie)?.value);
}

export async function isAdmin() {
  return isValidToken((await cookies()).get(adminCookie)?.value);
}

export async function revokeAdminSession(request: NextRequest) {
  const tokens = [bearerToken(request), request.cookies.get(adminCookie)?.value].filter(
    (token): token is string => Boolean(token && tokenPattern.test(token)),
  );
  for (const token of new Set(tokens)) {
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash(token)));
  }
}

export function loginFingerprint(email: string, request: NextRequest) {
  const address = (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  return tokenHash(`${email.trim().toLowerCase()}|${address}`);
}

export async function loginRateLimited(fingerprint: string) {
  const [row] = await db.select({ attempts: count() }).from(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.fingerprint, fingerprint), gt(adminLoginAttempts.createdAt, new Date(Date.now() - attemptWindowMs))));
  return row.attempts >= 8;
}

export async function markLoginFailed(fingerprint: string) {
  await db.insert(adminLoginAttempts).values({ fingerprint });
}

export async function clearLoginFailures(fingerprint: string) {
  await db.delete(adminLoginAttempts).where(eq(adminLoginAttempts.fingerprint, fingerprint));
}

// SameSite=None permits embedded previews; explicitly reject cross-site writes.
export function isTrustedAdminOrigin(request: NextRequest) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return [request.nextUrl.host, request.headers.get('host'), request.headers.get('x-forwarded-host')]
      .some(allowed => allowed === host);
  } catch {
    return false;
  }
}
