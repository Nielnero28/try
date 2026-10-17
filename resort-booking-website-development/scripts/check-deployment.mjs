#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('NOT READY: DATABASE_URL is missing. Set it as a server-side environment variable on your host.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
const required = [
  'accommodations', 'room_inventory', 'reservations', 'guests', 'payments',
  'availability_blocks', 'gallery_images', 'admin_users', 'admin_sessions', 'admin_login_attempts',
];

try {
  const { rows } = await pool.query(
    'select name, to_regclass(name) as relation from unnest($1::text[]) as t(name)',
    [required.map(name => `public.${name}`)],
  );
  const missing = rows.filter(row => !row.relation).map(row => row.name);
  if (missing.length) {
    console.error(`NOT READY: Missing database tables: ${missing.join(', ')}`);
    console.error('For a new empty database, run: npx drizzle-kit migrate');
    process.exitCode = 1;
  } else {
    console.log('Database connection and all 10 required tables: OK');
    const security = await pool.query(
      "select count(*)::int as secured from pg_class c join pg_namespace n on c.relnamespace = n.oid where n.nspname = 'public' and c.relname::text = any($1::text[]) and c.relrowsecurity",
      [required],
    );
    if (security.rows[0].secured !== required.length) {
      console.error('NOT READY: Row-level security is not enabled on every table. Apply all Drizzle migrations.');
      process.exitCode = 1;
    } else {
      console.log('Default-deny row-level security: OK');
      const result = await pool.query("select count(*)::int as total from admin_users where active = true and role = 'admin'");
      if (result.rows[0].total === 0) {
        console.error('NOT READY: No active staff admin. Run once: node scripts/rotate-admin.mjs owner@yourdomain.com');
        process.exitCode = 1;
      } else {
        console.log('Active staff account: OK');
        console.log('Deployment preflight: READY');
      }
    }
  }
} catch (error) {
  console.error('NOT READY: Could not connect to PostgreSQL. Check the hostname, firewall, connection credentials and SSL mode.');
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database URL hidden]') : 'Connection failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
