import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accommodations, roomInventory, reservations, guests, payments, availabilityBlocks, galleryImages } from '@/db/schema';
import { eq, and, lt, gt, notInArray, desc } from 'drizzle-orm';
import { isAdminRequest, isTrustedAdminOrigin } from '@/lib/admin-auth';
import { ensureSeed, validDates } from '@/lib/resort';
export const dynamic = 'force-dynamic';
const denied = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
const forbidden = () => NextResponse.json({ error: 'Request origin not allowed.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
const unavailable = () => NextResponse.json({ error: 'Staff data is temporarily unavailable. Check the database configuration and health endpoint.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
const inputErrors = new Set([
  'Invalid ID.', 'Invalid status.', 'Reservation not found.',
  'Cancelled reservations cannot be reopened. Ask the guest to make a new reservation.',
  'Rate must be between ₱500 and ₱1,000,000.', 'Invalid payment status.',
  'Invalid action.', 'Provide a room and a unique unit label.',
  'Provide a unit, dates and reason.', 'This unit already has a reservation during these dates.',
  'Provide a valid HTTPS image URL, description, and category.',
]);
function mutationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (inputErrors.has(message)) return NextResponse.json({ error: message }, { status: 400 });
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
  if (code === '23505') return NextResponse.json({ error: 'That record already exists. Please use a different label.' }, { status: 409 });
  console.error(`[PAINAWA] Staff update failed (${code}).`);
  return unavailable();
}
async function requireStaff(req: NextRequest) {
  try { return await isAdminRequest(req) ? null : denied(); }
  catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Staff authorization failed (${code}).`);
    return unavailable();
  }
}
export async function GET(req: NextRequest) {
  const authorization = await requireStaff(req);
  if (authorization) return authorization;
  try {
    await ensureSeed();
    const [rooms, units, bookings, blocks, gallery, paymentList, guestList] = await Promise.all([
      db.select().from(accommodations).orderBy(accommodations.id),
      db.select().from(roomInventory).orderBy(roomInventory.id),
      db.select({ id: reservations.id, reference: reservations.reference, accommodationId: reservations.accommodationId, roomId: reservations.roomId, guestId: reservations.guestId, checkIn: reservations.checkIn, checkOut: reservations.checkOut, adults: reservations.adults, children: reservations.children, nights: reservations.nights, total: reservations.total, subtotal: reservations.subtotal, fee: reservations.fee, discount: reservations.discount, status: reservations.status, paymentMethod: reservations.paymentMethod, specialRequests: reservations.specialRequests, createdAt: reservations.createdAt, roomName: accommodations.name, unitLabel: roomInventory.label, guestName: guests.name, guestEmail: guests.email, guestPhone: guests.phone }).from(reservations).innerJoin(accommodations, eq(reservations.accommodationId, accommodations.id)).innerJoin(roomInventory, eq(reservations.roomId, roomInventory.id)).innerJoin(guests, eq(reservations.guestId, guests.id)).orderBy(desc(reservations.createdAt)),
      db.select().from(availabilityBlocks).orderBy(desc(availabilityBlocks.id)),
      db.select().from(galleryImages).orderBy(galleryImages.position),
      db.select().from(payments).orderBy(desc(payments.id)),
      db.select().from(guests).orderBy(desc(guests.createdAt)),
    ]);
    return NextResponse.json({ rooms, units, bookings, blocks, gallery, payments: paymentList, guests: guestList }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Staff data load failed (${code}).`);
    return unavailable();
  }
}
export async function PATCH(req: NextRequest) {
  if (!isTrustedAdminOrigin(req)) return forbidden();
  const authorization = await requireStaff(req);
  if (authorization) return authorization;
  try {
    const b = await req.json(); const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) throw new Error('Invalid ID.');
    if (b.type === 'reservation') {
      if (!['Pending','Confirmed','Checked In','Completed','Cancelled'].includes(b.status)) throw new Error('Invalid status.');
      const [current] = await db.select().from(reservations).where(eq(reservations.id, id));
      if (!current) throw new Error('Reservation not found.');
      if (current.status === 'Cancelled' && b.status !== 'Cancelled') throw new Error('Cancelled reservations cannot be reopened. Ask the guest to make a new reservation.');
      await db.update(reservations).set({ status: b.status }).where(eq(reservations.id, id));
    } else if (b.type === 'room') {
      if (!Number.isInteger(Number(b.baseRate)) || Number(b.baseRate) < 500 || Number(b.baseRate) > 1000000) throw new Error('Rate must be between ₱500 and ₱1,000,000.');
      await db.update(accommodations).set({ baseRate: Number(b.baseRate), active: !!b.active }).where(eq(accommodations.id, id));
    } else if (b.type === 'unit') {
      await db.update(roomInventory).set({ active: !!b.active }).where(eq(roomInventory.id, id));
    } else if (b.type === 'gallery') {
      await db.update(galleryImages).set({ active: !!b.active }).where(eq(galleryImages.id, id));
    } else if (b.type === 'payment') {
      if (!['Unverified', 'Verified', 'Refunded'].includes(b.status)) throw new Error('Invalid payment status.');
      await db.update(payments).set({ status: b.status }).where(eq(payments.id, id));
    } else throw new Error('Invalid action.');
    return NextResponse.json({ success: true });
  } catch (error) { return mutationError(error); }
}
export async function POST(req: NextRequest) {
  if (!isTrustedAdminOrigin(req)) return forbidden();
  const authorization = await requireStaff(req);
  if (authorization) return authorization;
  try {
    const b = await req.json();
    if (b.type === 'unit') {
      const [room] = await db.select().from(accommodations).where(eq(accommodations.id, Number(b.accommodationId)));
      if (!room || typeof b.label !== 'string' || b.label.trim().length < 3 || b.label.length > 100) throw new Error('Provide a room and a unique unit label.');
      await db.insert(roomInventory).values({ accommodationId: room.id, label: b.label.trim() });
    } else if (b.type === 'block') {
      const roomId = Number(b.roomId); const [unit] = await db.select().from(roomInventory).where(eq(roomInventory.id, roomId));
      if (!unit || !validDates(b.startDate, b.endDate) || typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 200) throw new Error('Provide a unit, dates and reason.');
      const conflicting = await db.select().from(reservations).where(and(eq(reservations.roomId, roomId), lt(reservations.checkIn, b.endDate), gt(reservations.checkOut, b.startDate), notInArray(reservations.status, ['Cancelled','Completed']))).limit(1);
      if (conflicting.length) throw new Error('This unit already has a reservation during these dates.');
      await db.insert(availabilityBlocks).values({ roomId, startDate: b.startDate, endDate: b.endDate, reason: b.reason.trim() });
    } else if (b.type === 'gallery') {
      if (typeof b.url !== 'string' || !/^https:\/\//.test(b.url) || b.url.length > 2000 || typeof b.alt !== 'string' || b.alt.trim().length < 3 || b.alt.length > 255 || typeof b.category !== 'string' || b.category.length > 60) throw new Error('Provide a valid HTTPS image URL, description, and category.');
      await db.insert(galleryImages).values({ url: b.url, alt: b.alt.trim(), category: b.category.trim(), position: Number(b.position) || 10 });
    } else throw new Error('Invalid action.');
    return NextResponse.json({ success: true });
  } catch (error) { return mutationError(error); }
}
export async function DELETE(req: NextRequest) {
  if (!isTrustedAdminOrigin(req)) return forbidden();
  const authorization = await requireStaff(req);
  if (authorization) return authorization;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  try {
    await db.delete(availabilityBlocks).where(eq(availabilityBlocks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Availability block removal failed (${code}).`);
    return unavailable();
  }
}
