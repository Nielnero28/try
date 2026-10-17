/* Fictional, client-side-only records for the read-only staff preview.
   This module must never import the database or return real guest details. */
const images = {
  garden: 'https://images.pexels.com/photos/14025904/pexels-photo-14025904.jpeg?auto=compress&cs=tinysrgb&w=1000',
  pool: 'https://images.pexels.com/photos/2476632/pexels-photo-2476632.jpeg?auto=compress&cs=tinysrgb&w=1000',
  family: 'https://images.pexels.com/photos/14025907/pexels-photo-14025907.jpeg?auto=compress&cs=tinysrgb&w=1000',
  resort: 'https://images.pexels.com/photos/27429704/pexels-photo-27429704.jpeg?auto=compress&cs=tinysrgb&w=1000',
  palms: 'https://images.pexels.com/photos/27429693/pexels-photo-27429693.jpeg?auto=compress&cs=tinysrgb&w=1000',
};

export function makeAdminDemoData() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const day = (offset: number) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const createdAt = new Date().toISOString();
  const rooms = [
    { id: 1, name: 'Garden Villa', category: 'Villa', capacity: 2, baseRate: 4800, active: true, image: images.garden },
    { id: 2, name: 'Poolside Suite', category: 'Suite', capacity: 3, baseRate: 6500, active: true, image: images.pool },
    { id: 3, name: 'Family Cottage', category: 'Cottage', capacity: 5, baseRate: 8200, active: true, image: images.family },
  ];
  const units = [
    { id: 1, accommodationId: 1, label: 'Garden Villa 01', active: true },
    { id: 2, accommodationId: 1, label: 'Garden Villa 02', active: true },
    { id: 3, accommodationId: 1, label: 'Garden Villa 03', active: true },
    { id: 4, accommodationId: 2, label: 'Poolside Suite 01', active: true },
    { id: 5, accommodationId: 2, label: 'Poolside Suite 02', active: true },
    { id: 6, accommodationId: 2, label: 'Poolside Suite 03', active: true },
    { id: 7, accommodationId: 3, label: 'Family Cottage 01', active: true },
    { id: 8, accommodationId: 3, label: 'Family Cottage 02', active: true },
  ];
  const guests = [
    { id: 1, name: 'Maya Santos', email: 'maya@example.com', phone: 'Demo contact only', createdAt },
    { id: 2, name: 'Luca Reyes', email: 'luca@example.com', phone: 'Demo contact only', createdAt },
    { id: 3, name: 'Isabel Cruz', email: 'isabel@example.com', phone: 'Demo contact only', createdAt },
    { id: 4, name: 'Noah Lim', email: 'noah@example.com', phone: 'Demo contact only', createdAt },
    { id: 5, name: 'Ari Flores', email: 'ari@example.com', phone: 'Demo contact only', createdAt },
  ];
  const bookings = [
    { id: 1, reference: 'PNA-SAMPLE01', roomName: 'Garden Villa', unitLabel: 'Garden Villa 01', guestName: guests[0].name, guestEmail: guests[0].email, guestPhone: guests[0].phone, checkIn: day(4), checkOut: day(7), nights: 3, adults: 2, children: 0, subtotal: 14400, fee: 720, discount: 0, total: 15120, paymentMethod: 'Pay at property', status: 'Pending', specialRequests: 'A quiet villa if available.', createdAt },
    { id: 2, reference: 'PNA-SAMPLE02', roomName: 'Poolside Suite', unitLabel: 'Poolside Suite 01', guestName: guests[1].name, guestEmail: guests[1].email, guestPhone: guests[1].phone, checkIn: day(-1), checkOut: day(2), nights: 3, adults: 2, children: 0, subtotal: 19500, fee: 975, discount: 0, total: 20475, paymentMethod: 'Bank transfer', status: 'Checked In', specialRequests: null, createdAt },
    { id: 3, reference: 'PNA-SAMPLE03', roomName: 'Family Cottage', unitLabel: 'Family Cottage 01', guestName: guests[2].name, guestEmail: guests[2].email, guestPhone: guests[2].phone, checkIn: day(11), checkOut: day(16), nights: 5, adults: 2, children: 2, subtotal: 41000, fee: 2050, discount: 4100, total: 38950, paymentMethod: 'GCash', status: 'Confirmed', specialRequests: 'Traveling with children.', createdAt },
    { id: 4, reference: 'PNA-SAMPLE04', roomName: 'Garden Villa', unitLabel: 'Garden Villa 02', guestName: guests[3].name, guestEmail: guests[3].email, guestPhone: guests[3].phone, checkIn: day(-15), checkOut: day(-13), nights: 2, adults: 2, children: 0, subtotal: 9600, fee: 480, discount: 0, total: 10080, paymentMethod: 'Pay at property', status: 'Completed', specialRequests: null, createdAt },
    { id: 5, reference: 'PNA-SAMPLE05', roomName: 'Poolside Suite', unitLabel: 'Poolside Suite 02', guestName: guests[4].name, guestEmail: guests[4].email, guestPhone: guests[4].phone, checkIn: day(20), checkOut: day(22), nights: 2, adults: 2, children: 0, subtotal: 13000, fee: 650, discount: 0, total: 13650, paymentMethod: 'GCash', status: 'Cancelled', specialRequests: null, createdAt },
  ];
  const payments = bookings.map((booking, index) => ({ id: index + 1, reservationId: booking.id, method: booking.paymentMethod, amount: booking.total, status: index === 3 ? 'Verified' : 'Unverified' }));
  const blocks = [{ id: 1, roomId: 3, startDate: day(25), endDate: day(27), reason: 'Sample maintenance block' }];
  const gallery = [
    { id: 1, url: images.resort, alt: 'Tropical resort pool surrounded by palms', category: 'Resort', active: true },
    { id: 2, url: images.garden, alt: 'Wooden villa bedroom', category: 'Rooms', active: true },
    { id: 3, url: images.pool, alt: 'Tropical poolside suite', category: 'Rooms', active: true },
    { id: 4, url: images.palms, alt: 'Palm-lined resort grounds', category: 'Resort', active: true },
  ];
  return { rooms, units, guests, bookings, payments, blocks, gallery };
}
