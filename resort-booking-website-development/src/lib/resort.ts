import { db } from '@/db';
import { accommodations, roomInventory, galleryImages, reservations, availabilityBlocks } from '@/db/schema';
import { and, eq, lt, gt, notInArray, asc, sql } from 'drizzle-orm';

export const sampleRooms = [
  { name: 'Garden Villa', slug: 'garden-villa', category: 'Villa', description: 'A peaceful hideaway wrapped in lush tropical gardens, with your own private veranda for slow mornings.', image: 'https://images.pexels.com/photos/14025904/pexels-photo-14025904.jpeg?auto=compress&cs=tinysrgb&w=1200', capacity: 2, baseRate: 4800, amenities: 'King bed,Private veranda,Wi-Fi,Air conditioning', active: true },
  { name: 'Poolside Suite', slug: 'poolside-suite', category: 'Suite', description: 'Wake up steps from the water in an airy suite made for effortless days and golden-hour dips.', image: 'https://images.pexels.com/photos/2476632/pexels-photo-2476632.jpeg?auto=compress&cs=tinysrgb&w=1200', capacity: 3, baseRate: 6500, amenities: 'King bed,Pool access,Wi-Fi,Breakfast', active: true },
  { name: 'Family Cottage', slug: 'family-cottage', category: 'Cottage', description: 'Room to reconnect. A warm, inviting cottage for the whole crew, surrounded by nature.', image: 'https://images.pexels.com/photos/14025907/pexels-photo-14025907.jpeg?auto=compress&cs=tinysrgb&w=1200', capacity: 5, baseRate: 8200, amenities: 'Two bedrooms,Garden view,Wi-Fi,Breakfast', active: true },
];
export const sampleGallery = [
  { url: 'https://images.pexels.com/photos/27429704/pexels-photo-27429704.jpeg?auto=compress&cs=tinysrgb&w=1400', alt: 'Tropical resort pool surrounded by palms', category: 'Resort', position: 1, active: true },
  { url: 'https://images.pexels.com/photos/14025904/pexels-photo-14025904.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Warm wooden villa bedroom', category: 'Rooms', position: 2, active: true },
  { url: 'https://images.pexels.com/photos/2476632/pexels-photo-2476632.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Poolside tropical villa', category: 'Rooms', position: 3, active: true },
  { url: 'https://images.pexels.com/photos/27429693/pexels-photo-27429693.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Palm-lined resort grounds', category: 'Resort', position: 4, active: true },
  { url: 'https://images.pexels.com/photos/14025910/pexels-photo-14025910.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Peaceful bedroom retreat', category: 'Rooms', position: 5, active: true },
  { url: 'https://images.pexels.com/photos/36758187/pexels-photo-36758187.jpeg?auto=compress&cs=tinysrgb&w=1200', alt: 'Aerial view of a tropical resort', category: 'Resort', position: 6, active: true },
];
export async function ensureSeed() {
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(987654321)`);
    const existing = await tx.select({ id: accommodations.id }).from(accommodations).limit(1);
    if (!existing.length) {
      for (const room of sampleRooms) {
        const [created] = await tx.insert(accommodations).values(room).onConflictDoNothing().returning();
        if (created) await tx.insert(roomInventory).values(Array.from({ length: room.slug === 'family-cottage' ? 2 : 3 }, (_, i) => ({ accommodationId: created.id, label: `${room.name} ${String(i + 1).padStart(2, '0')}` }))).onConflictDoNothing();
      }
    }
    const gallery = await tx.select({ id: galleryImages.id }).from(galleryImages).limit(1);
    if (!gallery.length) await tx.insert(galleryImages).values(sampleGallery);
  });
}
export async function getRooms() { await ensureSeed(); return db.select().from(accommodations).where(eq(accommodations.active, true)).orderBy(asc(accommodations.id)); }
export async function getGallery() { await ensureSeed(); return db.select().from(galleryImages).where(eq(galleryImages.active, true)).orderBy(asc(galleryImages.position)); }
export const money = (amount: number) => '₱' + amount.toLocaleString('en-PH');
export function getNights(checkIn: string, checkOut: string) { return Math.round((Date.parse(checkOut + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z')) / 86400000); }
export function validDates(checkIn: string, checkOut: string) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(checkIn) || !pattern.test(checkOut)) return false;
  const start = new Date(checkIn + 'T00:00:00Z');
  const end = new Date(checkOut + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.toISOString().slice(0,10) !== checkIn || end.toISOString().slice(0,10) !== checkOut) return false;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  return checkIn >= today && getNights(checkIn, checkOut) >= 1 && getNights(checkIn, checkOut) <= 30;
}
export function price(rate: number, nights: number) { const subtotal = rate * nights; const fee = Math.round(subtotal * .05); const discount = nights >= 5 ? Math.round(subtotal * .1) : 0; return { nightlyRate: rate, nights, subtotal, fee, discount, total: subtotal + fee - discount }; }
export async function availableRooms(accommodationId: number, checkIn: string, checkOut: string) {
  const units = await db.select().from(roomInventory).where(and(eq(roomInventory.accommodationId, accommodationId), eq(roomInventory.active, true)));
  const booked = await db.select({ roomId: reservations.roomId }).from(reservations).where(and(eq(reservations.accommodationId, accommodationId), lt(reservations.checkIn, checkOut), gt(reservations.checkOut, checkIn), notInArray(reservations.status, ['Cancelled', 'Completed'])));
  const blocked = await db.select({ roomId: availabilityBlocks.roomId }).from(availabilityBlocks).where(and(lt(availabilityBlocks.startDate, checkOut), gt(availabilityBlocks.endDate, checkIn)));
  const taken = new Set([...booked, ...blocked].map(x => x.roomId));
  return units.filter(u => !taken.has(u.id));
}
