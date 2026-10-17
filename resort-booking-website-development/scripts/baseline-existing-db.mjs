#!/usr/bin/env node
// For databases that already have the schema from `drizzle-kit push`.
// This does not create application tables or modify guest reservations.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

if (process.argv[2] !== '--confirm-baseline') {
  console.error('Usage: node scripts/baseline-existing-db.mjs --confirm-baseline');
  console.error('Back up the existing database before baselining its migration history.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must point to the existing database.');
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), 'drizzle');
const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));
const first = journal.entries[0];
if (!first || first.idx !== 0) throw new Error('Initial migration not found.');
const snapshot = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/0000_snapshot.json'), 'utf8'));
const migrationHash = entry => createHash('sha256')
  .update(fs.readFileSync(path.join(migrationsDir, `${entry.tag}.sql`), 'utf8'))
  .digest('hex');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 });
let client;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(913741621)');
  for (const [qualifiedName, table] of Object.entries(snapshot.tables)) {
    const [schema, name] = qualifiedName.split('.');
    const { rows } = await client.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',
      [schema, name],
    );
    const actualColumns = new Set(rows.map(row => row.column_name));
    const expectedColumns = Object.keys(table.columns);
    if (expectedColumns.some(column => !actualColumns.has(column)) || actualColumns.size !== expectedColumns.length) {
      throw new Error(`${qualifiedName} does not match the initial migration columns. No baseline applied.`);
    }
    const { rows: constraints } = await client.query(
      'SELECT conname FROM pg_constraint WHERE conrelid = to_regclass($1)',
      [qualifiedName],
    );
    const actualConstraints = new Set(constraints.map(row => row.conname));
    const requiredConstraints = [
      `${name}_pkey`,
      ...Object.keys(table.foreignKeys || {}),
      ...Object.keys(table.uniqueConstraints || {}),
    ];
    if (requiredConstraints.some(constraint => !actualConstraints.has(constraint))) {
      throw new Error(`${qualifiedName} is missing an expected key or foreign-key constraint. No baseline applied.`);
    }
    const { rows: indexes } = await client.query(
      'SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename=$2',
      [schema, name],
    );
    const actualIndexes = new Set(indexes.map(row => row.indexname));
    if (Object.keys(table.indexes || {}).some(index => !actualIndexes.has(index))) {
      throw new Error(`${qualifiedName} is missing a required index. No baseline applied.`);
    }
  }
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)');
  const { rows: recorded } = await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1');
  if (recorded.length) {
    const known = journal.entries.some(entry =>
      Number(recorded[0].created_at) === entry.when && recorded[0].hash === migrationHash(entry));
    if (!known) throw new Error('A different migration history already exists. No changes made.');
    console.log('A known migration is already recorded; no changes made.');
  } else {
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [migrationHash(first), first.when]);
    console.log('Existing schema verified; initial migration recorded without touching bookings or staff accounts.');
    console.log('Next: npx drizzle-kit migrate');
  }
  await client.query('COMMIT');
} catch (error) {
  if (client) await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Unable to baseline database.');
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
