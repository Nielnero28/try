import { db } from '@/db';
import { sql } from 'drizzle-orm';

export type BackendStatus = 'ready' | 'configuration_missing' | 'database_unavailable' | 'schema_pending' | 'application_error';
export type BackendReadiness = { ok: boolean; status: BackendStatus; message: string };

const ready: BackendReadiness = { ok: true, status: 'ready', message: 'The booking database is ready.' };

export const backendMessages: Record<Exclude<BackendStatus, 'ready'>, string> = {
  configuration_missing: 'The booking database has not been configured. Set DATABASE_URL on your deployment host.',
  database_unavailable: 'The booking database could not be reached. Check the connection string, SSL, database permissions and network access.',
  schema_pending: 'The booking tables or security migration are missing. Apply the Drizzle migrations to your deployment database.',
  application_error: 'The booking service could not load. Check the server logs and database permissions before accepting reservations.',
};

export async function checkBackendReadiness(): Promise<BackendReadiness> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, status: 'configuration_missing', message: backendMessages.configuration_missing };
  }
  try {
    const result = await db.execute(sql`
      select
        to_regclass('public.accommodations') is not null as accommodations,
        to_regclass('public.room_inventory') is not null as inventory,
        to_regclass('public.reservations') is not null as reservations,
        to_regclass('public.guests') is not null as guests,
        to_regclass('public.payments') is not null as payments,
        to_regclass('public.availability_blocks') is not null as blocks,
        to_regclass('public.gallery_images') is not null as gallery,
        to_regclass('public.admin_users') is not null as staff,
        to_regclass('public.admin_sessions') is not null as sessions,
        to_regclass('public.admin_login_attempts') is not null as attempts,
        (
          select count(*) = 10 from pg_class c
          join pg_namespace n on c.relnamespace = n.oid
          where n.nspname = 'public'
            and c.relname in (
              'accommodations', 'room_inventory', 'reservations', 'guests', 'payments',
              'availability_blocks', 'gallery_images', 'admin_users', 'admin_sessions', 'admin_login_attempts'
            )
            and c.relrowsecurity
        ) as row_security
    `);
    const checks = result.rows[0] as Record<string, boolean> | undefined;
    if (!checks || Object.values(checks).some(check => check !== true)) {
      return { ok: false, status: 'schema_pending', message: backendMessages.schema_pending };
    }
    return ready;
  } catch (error) {
    // No connection strings or database errors are sent to the browser.
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unavailable';
    console.error(`[PAINAWA] Database readiness check failed (${code}).`);
    return { ok: false, status: 'database_unavailable', message: backendMessages.database_unavailable };
  }
}
