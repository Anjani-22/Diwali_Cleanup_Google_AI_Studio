import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email'),
  phone: text('phone'),
  phoneVerified: boolean('phone_verified').default(false).notNull(),
  name: text('name').notNull(),
  photoUrl: text('photo_url'),
  homeLat: doublePrecision('home_lat').default(17.4401).notNull(),
  homeLng: doublePrecision('home_lng').default(78.3489).notNull(),
  homePincode: text('home_pincode').default('500081').notNull(),
  homeCity: text('home_city').default('Hyderabad').notNull(),
  role: text('role').default('user').notNull(),
  aiQuotaDate: text('ai_quota_date'),
  aiQuotaUsed: integer('ai_quota_used').default(0).notNull(),
  freeRequestsDate: text('free_requests_date'),
  freeRequestsUsed: integer('free_requests_used').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const listings = pgTable('listings', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  brand: text('brand'),
  images: jsonb('images').$type<string[]>().notNull(),
  mode: text('mode').notNull(), // 'sell' | 'free' | 'ngo'
  condition: text('condition').notNull(), // 'new' | 'almost' | 'used'
  category: text('category').notNull(),
  price: integer('price').default(0).notNull(),
  currency: text('currency').default('INR').notNull(),
  expiryDate: text('expiry_date'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  pincode: text('pincode').notNull(),
  locality: text('locality').notNull(),
  aiMetadata: jsonb('ai_metadata').$type<Record<string, unknown>>(),
  status: text('status').default('active').notNull(), // 'active' | 'sold' | 'donated' | 'expired' | 'removed' | 'flagged'
  flagReason: text('flag_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  listingId: integer('listing_id')
    .references(() => listings.id)
    .notNull(),
  buyerId: integer('buyer_id')
    .references(() => users.id)
    .notNull(),
  sellerId: integer('seller_id')
    .references(() => users.id)
    .notNull(),
  amount: integer('amount').default(0).notNull(),
  shippingFee: integer('shipping_fee').default(0).notNull(),
  paymentMethod: text('payment_method').notNull(), // 'upi' | 'card' | 'netbanking' | 'cod' | 'free_request'
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  deliveryMode: text('delivery_mode').notNull(), // 'pickup' | 'ship'
  shippingAddress: text('shipping_address'),
  shiprocketAwb: text('shiprocket_awb'),
  trackingUrl: text('tracking_url'),
  status: text('status').default('paid').notNull(), // 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ngos = pgTable('ngos', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city').notNull(),
  email: text('email').notNull(),
  phoneWhatsapp: text('phone_whatsapp').notNull(),
  address: text('address').notNull(),
  categoriesAccepted: jsonb('categories_accepted').$type<string[]>().notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ngoRequests = pgTable('ngo_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  ngoId: integer('ngo_id')
    .references(() => ngos.id)
    .notNull(),
  items: jsonb('items')
    .$type<Array<{ listingId?: number; title: string; category: string; condition: string }>>()
    .notNull(),
  photos: jsonb('photos').$type<string[]>().notNull(),
  pickupAddress: text('pickup_address').notNull(),
  contactPhone: text('contact_phone').notNull(),
  status: text('status').default('sent').notNull(), // 'sent' | 'accepted' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  listings: many(listings),
  ngoRequests: many(ngoRequests),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  seller: one(users, {
    fields: [listings.sellerId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  listing: one(listings, {
    fields: [transactions.listingId],
    references: [listings.id],
  }),
  buyer: one(users, {
    fields: [transactions.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [transactions.sellerId],
    references: [users.id],
  }),
}));

export const ngosRelations = relations(ngos, ({ many }) => ({
  requests: many(ngoRequests),
}));

export const ngoRequestsRelations = relations(ngoRequests, ({ one }) => ({
  user: one(users, {
    fields: [ngoRequests.userId],
    references: [users.id],
  }),
  ngo: one(ngos, {
    fields: [ngoRequests.ngoId],
    references: [ngos.id],
  }),
}));
