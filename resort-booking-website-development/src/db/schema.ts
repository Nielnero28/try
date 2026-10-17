import { pgTable, serial, integer, varchar, text, boolean, date, timestamp, index } from 'drizzle-orm/pg-core';

// All tables are private to the server. On Supabase, default-deny RLS prevents
// anon/authenticated REST clients from reading guest data or staff hashes.
// The app connects using the table-owning PostgreSQL role, which bypasses RLS.
export const accommodations = pgTable('accommodations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  category: varchar('category', { length: 60 }).notNull(),
  description: text('description').notNull(),
  image: text('image').notNull(),
  capacity: integer('capacity').notNull(),
  baseRate: integer('base_rate').notNull(),
  amenities: text('amenities').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const roomInventory = pgTable('room_inventory', {
  id: serial('id').primaryKey(),
  accommodationId: integer('accommodation_id').notNull().references(() => accommodations.id),
  label: varchar('label', { length: 100 }).notNull().unique(),
  active: boolean('active').notNull().default(true),
}).enableRLS();

export const guests = pgTable('guests', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const reservations = pgTable('reservations', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 32 }).notNull().unique(),
  accommodationId: integer('accommodation_id').notNull().references(() => accommodations.id),
  roomId: integer('room_id').notNull().references(() => roomInventory.id),
  guestId: integer('guest_id').notNull().references(() => guests.id),
  checkIn: date('check_in').notNull(),
  checkOut: date('check_out').notNull(),
  adults: integer('adults').notNull(),
  children: integer('children').notNull().default(0),
  nights: integer('nights').notNull(),
  nightlyRate: integer('nightly_rate').notNull(),
  subtotal: integer('subtotal').notNull(),
  fee: integer('fee').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),
  paymentMethod: varchar('payment_method', { length: 40 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Pending'),
  specialRequests: text('special_requests'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  reservationId: integer('reservation_id').notNull().references(() => reservations.id),
  method: varchar('method', { length: 40 }).notNull(),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Unverified'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const availabilityBlocks = pgTable('availability_blocks', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').notNull().references(() => roomInventory.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  reason: varchar('reason', { length: 200 }).notNull(),
}).enableRLS();

export const galleryImages = pgTable('gallery_images', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  alt: varchar('alt', { length: 255 }).notNull(),
  category: varchar('category', { length: 60 }).notNull(),
  position: integer('position').notNull().default(0),
  active: boolean('active').notNull().default(true),
}).enableRLS();

// Staff credentials and sessions persist independently of a preview's .env file.
// Raw passwords and raw session tokens are never saved in the database.
export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 30 }).notNull().default('admin'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const adminSessions = pgTable('admin_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  adminId: integer('admin_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('admin_sessions_admin_idx').on(table.adminId)]).enableRLS();

export const adminLoginAttempts = pgTable('admin_login_attempts', {
  id: serial('id').primaryKey(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('admin_login_attempts_lookup_idx').on(table.fingerprint, table.createdAt)]).enableRLS();
