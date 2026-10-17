import { isAdmin, adminConfigured } from '@/lib/admin-auth';
import { checkBackendReadiness } from '@/lib/readiness';
import AdminDashboard from '@/components/AdminDashboard';
import BackendSetup from '@/components/BackendSetup';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Staff Dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

async function getStaffAccess() {
  try {
    const [authenticated, configured] = await Promise.all([isAdmin(), adminConfigured()]);
    return { authenticated, configured };
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Staff page could not query the database (${code}).`);
    return null;
  }
}

export default async function AdminPage() {
  const backend = await checkBackendReadiness();
  if (backend.status !== 'ready') return <BackendSetup status={backend.status} />;

  const access = await getStaffAccess();
  if (!access) return <BackendSetup status="application_error" />;

  return <AdminDashboard authenticated={access.authenticated} configured={access.configured} />;
}
