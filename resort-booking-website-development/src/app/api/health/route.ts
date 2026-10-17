import { checkBackendReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkBackendReadiness();
  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
