import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { accommodations, roomInventory, guests, reservations, payments, availabilityBlocks } from '@/db/schema';
import { and, eq, gt, lt, notInArray, sql } from 'drizzle-orm';
import { getNights, price, validDates, ensureSeed } from '@/lib/resort';
import { checkBackendReadiness } from '@/lib/readiness';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const backend = await checkBackendReadiness();
  if (!backend.ok) return NextResponse.json({ error: backend.message, status: backend.status }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const body = await req.json();
    const { accommodationId, checkIn, checkOut, name, email, phone, specialRequests, paymentMethod } = body;
    const adults = Number(body.adults), children = Number(body.children || 0);
    if (!validDates(checkIn, checkOut)) return NextResponse.json({ error: 'Please choose valid dates. Stays must be between 1 and 30 nights.' }, { status: 400 });
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) return NextResponse.json({ error: 'Please enter a valid guest count.' }, { status: 400 });
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 160 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || typeof phone !== 'string' || !/^[+\d\s()-]{7,40}$/.test(phone) || typeof specialRequests !== 'string' || specialRequests.length > 1500 || !['GCash', 'Bank transfer', 'Pay at property'].includes(paymentMethod)) return NextResponse.json({ error: 'Please complete your contact and payment details correctly.' }, { status: 400 });
    await ensureSeed();
    const [room] = await db.select().from(accommodations).where(and(eq(accommodations.id, Number(accommodationId)), eq(accommodations.active, true)));
    if (!room) return NextResponse.json({ error: 'Accommodation not found.' }, { status: 404 });
    if (adults + children > room.capacity) return NextResponse.json({ error: `This accommodation allows up to ${room.capacity} guests.` }, { status: 400 });
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${room.id})`);
      const units = await tx.select().from(roomInventory).where(and(eq(roomInventory.accommodationId, room.id), eq(roomInventory.active, true)));
      const booked = await tx.select({ roomId: reservations.roomId }).from(reservations).where(and(eq(reservations.accommodationId, room.id), lt(reservations.checkIn, checkOut), gt(reservations.checkOut, checkIn), notInArray(reservations.status, ['Cancelled', 'Completed'])));
      const blocked = await tx.select({ roomId: availabilityBlocks.roomId }).from(availabilityBlocks).where(and(lt(availabilityBlocks.startDate, checkOut), gt(availabilityBlocks.endDate, checkIn)));
      const taken = new Set([...booked, ...blocked].map(x => x.roomId));
      const unit = units.find(u => !taken.has(u.id));
      if (!unit) return null;
      const [guest] = await tx.insert(guests).values({ name: name.trim(), email: email.toLowerCase().trim(), phone: phone.trim() }).returning();
      const costs = price(room.baseRate, getNights(checkIn, checkOut));
      const reference = 'PNA-' + randomBytes(4).toString('hex').toUpperCase();
      const [reservation] = await tx.insert(reservations).values({ reference, accommodationId: room.id, roomId: unit.id, guestId: guest.id, checkIn, checkOut, adults, children, ...costs, paymentMethod, specialRequests: specialRequests.trim(), status: 'Pending' }).returning();
      await tx.insert(payments).values({ reservationId: reservation.id, method: paymentMethod, amount: costs.total, status: 'Unverified' });
      return { reference, status: 'Pending', accommodation: room.name, checkIn, checkOut, ...costs, paymentMethod };
    });
    if (!result) return NextResponse.json({ error: 'This stay just sold out for your dates. Please choose another room or dates.' }, { status: 409 });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Reservation request failed (${code}).`);
    return NextResponse.json({ error: 'We could not verify your reservation request. Please check your reference and email before trying again.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export async function GET(req: NextRequest) {
  const reference = (req.nextUrl.searchParams.get('reference') || '').trim().toUpperCase();
  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (!reference || !email) return NextResponse.json({ error: 'Reference and email are required.' }, { status: 400 });
  const backend = await checkBackendReadiness();
  if (!backend.ok) return NextResponse.json({ error: backend.message, status: backend.status }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const [row] = await db.select({ reference: reservations.reference, status: reservations.status, checkIn: reservations.checkIn, checkOut: reservations.checkOut, total: reservations.total, paymentMethod: reservations.paymentMethod, accommodation: accommodations.name, guest: guests.name }).from(reservations).innerJoin(guests, eq(reservations.guestId, guests.id)).innerJoin(accommodations, eq(reservations.accommodationId, accommodations.id)).where(and(eq(reservations.reference, reference), eq(guests.email, email)));
    if (!row) return NextResponse.json({ error: 'No reservation found for that reference and email.' }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'unknown';
    console.error(`[PAINAWA] Reservation lookup failed (${code}).`);
    return NextResponse.json({ error: 'Reservation lookup is temporarily unavailable. Please try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
