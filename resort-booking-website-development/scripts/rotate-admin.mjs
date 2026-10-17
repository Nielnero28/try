#!/usr/bin/env node
// Run after `npx drizzle-kit push`: node scripts/rotate-admin.mjs owner@example.com
// The generated password is printed once. Only its bcrypt hash is persisted.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, serial, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import pg from 'pg';

const email = (process.argv[2] || 'owner@painawa.local').trim().toLowerCase();
if (!process.env.DATABASE_URL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Provide DATABASE_URL and a valid staff email address.');
  process.exit(1);
}

// The same table definitions are maintained in src/db/schema.ts. Keeping this
// small CLI as JavaScript allows it to run with Node without a TS runner.
const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 30 }).notNull(),
  active: boolean('active').notNull(),
});
const adminSessions = pgTable('admin_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  adminId: integer('admin_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
try {
  const password = randomBytes(24).toString('base64url');
  const passwordHash = hashSync(password, 12);
  const [owner] = await db.insert(adminUsers).values({ email, passwordHash, role: 'admin', active: true })
    .onConflictDoUpdate({
      target: adminUsers.email,
      set: { passwordHash, role: 'admin', active: true },
    }).returning();
  await db.delete(adminSessions).where(eq(adminSessions.adminId, owner.id));
  console.log('Owner account saved in PostgreSQL. Existing sessions for this account were revoked.');
  console.log(`Staff email: ${email}`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log('Store this password privately. Rotate it again before a public launch.');
} catch (error) {
  console.error('Unable to save owner account. Apply the schema with `npx drizzle-kit push` first.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
