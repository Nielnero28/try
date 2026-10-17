import { NextRequest, NextResponse } from 'next/server';
import { getRooms, availableRooms, validDates } from '@/lib/resort';
import { checkBackendReadiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const checkIn = req.nextUrl.searchParams.get('checkIn') || '';
  const checkOut = req.nextUrl.searchParams.get('checkOut') || '';
  if (!validDates(checkIn, checkOut)) {
    return NextResponse.json({ error: 'Choose valid dates (1–30 nights, starting today or later).' }, { status: 400 });
  }
  const backend = await checkBackendReadiness();
  if (!backend.ok) {
    return NextResponse.json({ error: backend.message, status: backend.status }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const rooms = await getRooms();
    const availability = await Promise.all(rooms.map(async room => ({ id: room.id, available: (await availableRooms(room.id, checkIn, checkOut)).length })));
    return NextResponse.json({ availability }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Availability query failed (${code}).`);
    return NextResponse.json({ error: 'Availability is temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
