import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

type Database = ReturnType<typeof drizzle>;
type GlobalWithDatabase = typeof globalThis & {
  __painawaPool?: Pool;
  __painawaDatabase?: Database;
};

const globalWithDatabase = globalThis as GlobalWithDatabase;

function connect(): Database {
  if (globalWithDatabase.__painawaDatabase) return globalWithDatabase.__painawaDatabase;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Configure a PostgreSQL database before starting the resort.');
  }

  // pg reads sslmode=require from a managed Postgres connection string.
  // A small shared pool avoids exhausting connections on serverless instances.
  const pool = globalWithDatabase.__painawaPool ?? new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
  if (!globalWithDatabase.__painawaPool) {
    pool.on('error', (error) => {
      console.error('PostgreSQL idle connection error:', error.message);
    });
    globalWithDatabase.__painawaPool = pool;
  }
  const database = drizzle(pool);
  globalWithDatabase.__painawaDatabase = database;
  return database;
}

// Connection creation is delayed until a query. Next.js can compile routes
// before runtime secrets are injected, without silently falling back to a
// local PostgreSQL instance when DATABASE_URL is missing.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    return Reflect.get(connect(), property);
  },
});
