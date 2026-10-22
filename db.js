import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import {assertProductionConfig,runtimeConfig} from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

assertProductionConfig();
const dbPath = runtimeConfig.database.path || process.env.DB_PATH || path.join(__dirname, 'rentall.sqlite');
fs.mkdirSync(path.dirname(dbPath),{recursive:true});
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(146,'rc44-production-foundation');
`);

export const databaseRuntime=Object.freeze({driver:'sqlite',source:runtimeConfig.database.source,path:dbPath,persistent:runtimeConfig.database.source!=='default-local'});
export function checkDatabase(){
  try{
    const row=db.prepare('SELECT 1 AS ok').get();
    const migration=db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
    return {ok:row?.ok===1,migrationVersion:Number(migration?.version||0),driver:'sqlite',source:databaseRuntime.source,persistent:databaseRuntime.persistent};
  }catch{return {ok:false,migrationVersion:0,driver:'sqlite',source:databaseRuntime.source,persistent:databaseRuntime.persistent}}
}

export function closeDatabase(){
  if(db.open){db.pragma('wal_checkpoint(TRUNCATE)');db.close();}
}

db.exec(`
  CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    stripe_account TEXT,
    source TEXT NOT NULL DEFAULT 'stripe',
    received_at TEXT NOT NULL,
    processing_started_at TEXT,
    processed_at TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    error_message TEXT,
    payload_json TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
    ON webhook_events(received_at DESC);

  CREATE INDEX IF NOT EXISTS idx_webhook_events_type
    ON webhook_events(event_type);

  CREATE INDEX IF NOT EXISTS idx_webhook_events_status
    ON webhook_events(status);
`);


db.exec(`
  CREATE TABLE IF NOT EXISTS rental_listings (
    listing_id TEXT PRIMARY KEY,
    owner_email TEXT,
    title TEXT NOT NULL,
    total_quantity INTEGER NOT NULL CHECK(total_quantity >= 0)
  );

  CREATE TABLE IF NOT EXISTS rental_bookings (
    booking_id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL,
    FOREIGN KEY(listing_id) REFERENCES rental_listings(listing_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rental_bookings_listing_dates
    ON rental_bookings(listing_id, start_date, end_date);

  CREATE INDEX IF NOT EXISTS idx_rental_bookings_status
    ON rental_bookings(status);
`);

// Forward-compatible columns for lifecycle / audit data.
for (const sql of [
  `ALTER TABLE rental_bookings ADD COLUMN updated_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN cancelled_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN returned_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN cancellation_reason TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN customer_name TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN customer_email TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN customer_phone TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN accommodation_name TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN delivery_city TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN delivery_address TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN room_number TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN contact_person TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN delivery_instructions TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN order_value REAL`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}


// V33: run all schema migrations BEFORE any statement that references
// the migrated columns. This avoids "no such column" errors at import time.
for (const sql of [
  `ALTER TABLE rental_listings ADD COLUMN cancellation_policy TEXT DEFAULT 'moderate'`,
  `ALTER TABLE rental_listings ADD COLUMN moderation_status TEXT DEFAULT 'active'`,
  `ALTER TABLE rental_listings ADD COLUMN data_json TEXT`,
  `ALTER TABLE rental_listings ADD COLUMN created_at TEXT`,
  `ALTER TABLE rental_listings ADD COLUMN updated_at TEXT`,

  `ALTER TABLE rental_bookings ADD COLUMN expires_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN stripe_refund_id TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN refund_status TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN refund_amount REAL`,
  `ALTER TABLE rental_bookings ADD COLUMN return_condition TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN return_notes TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN payment_token_hash TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN guest_access_revoked_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN stripe_payment_intent_id TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`,
  `ALTER TABLE rental_bookings ADD COLUMN platform_fee_amount REAL`,
  `ALTER TABLE rental_bookings ADD COLUMN supplier_amount REAL`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_amount REAL DEFAULT 0`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_status TEXT DEFAULT 'not_required'`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_resolution TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_resolved_at TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_payment_intent_id TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN security_deposit_provider_status TEXT`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}

const insertEventStmt = db.prepare(`
  INSERT INTO webhook_events (
    event_id, event_type, stripe_account, source, received_at,
    status, payload_json, attempt_count
  )
  VALUES (
    @event_id, @event_type, @stripe_account, @source, @received_at,
    @status, @payload_json, 1
  )
`);

const incrementDuplicateStmt = db.prepare(`
  UPDATE webhook_events
  SET attempt_count = attempt_count + 1
  WHERE event_id = ?
`);

const getEventStmt = db.prepare(`
  SELECT
    id,
    event_id AS eventId,
    event_type AS type,
    stripe_account AS account,
    source,
    received_at AS receivedAt,
    processing_started_at AS processingStartedAt,
    processed_at AS processedAt,
    status,
    error_message AS error,
    attempt_count AS attemptCount
  FROM webhook_events
  WHERE event_id = ?
`);

const markProcessingStmt = db.prepare(`
  UPDATE webhook_events
  SET status = 'processing',
      processing_started_at = @processing_started_at,
      error_message = NULL
  WHERE event_id = @event_id
`);

const markProcessedStmt = db.prepare(`
  UPDATE webhook_events
  SET status = 'processed',
      processed_at = @processed_at,
      error_message = NULL
  WHERE event_id = @event_id
`);

const markFailedStmt = db.prepare(`
  UPDATE webhook_events
  SET status = 'failed',
      processed_at = @processed_at,
      error_message = @error_message
  WHERE event_id = @event_id
`);

export function beginWebhookEvent({
  eventId,
  type,
  account = null,
  source = 'stripe',
  payload = null
}) {
  const receivedAt = new Date().toISOString();

  const tx = db.transaction(() => {
    try {
      insertEventStmt.run({
        event_id: eventId,
        event_type: type || 'unknown',
        stripe_account: account,
        source,
        received_at: receivedAt,
        status: 'received',
        payload_json: payload ? JSON.stringify(payload) : null
      });

      markProcessingStmt.run({
        event_id: eventId,
        processing_started_at: new Date().toISOString()
      });

      return { duplicate: false, event: getWebhookEvent(eventId) };
    } catch (err) {
      // SQLite UNIQUE constraint = same Stripe event already received.
      if (String(err.message).includes('UNIQUE constraint failed')) {
        incrementDuplicateStmt.run(eventId);
        return { duplicate: true, event: getWebhookEvent(eventId) };
      }
      throw err;
    }
  });

  return tx();
}

export function markWebhookProcessed(eventId) {
  markProcessedStmt.run({
    event_id: eventId,
    processed_at: new Date().toISOString()
  });
  return getWebhookEvent(eventId);
}

export function markWebhookFailed(eventId, errorMessage) {
  markFailedStmt.run({
    event_id: eventId,
    processed_at: new Date().toISOString(),
    error_message: String(errorMessage || 'Unknown webhook processing error')
  });
  return getWebhookEvent(eventId);
}

export function getWebhookEvent(eventId) {
  return getEventStmt.get(eventId) || null;
}

export function listWebhookEvents({
  limit = 50,
  type = null,
  status = null,
  from = null,
  to = null
} = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit || 50), 500));

  const where = [];
  const params = {};

  if (type && type !== 'all') {
    where.push('event_type = @type');
    params.type = type;
  }
  if (status && status !== 'all') {
    where.push('status = @status');
    params.status = status;
  }
  if (from) {
    where.push('received_at >= @from');
    params.from = from;
  }
  if (to) {
    where.push('received_at <= @to');
    params.to = to;
  }

  const sql = `
    SELECT
      id,
      event_id AS eventId,
      event_type AS type,
      stripe_account AS account,
      source,
      received_at AS receivedAt,
      processing_started_at AS processingStartedAt,
      processed_at AS processedAt,
      status,
      error_message AS error,
      attempt_count AS attemptCount
    FROM webhook_events
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY received_at DESC
    LIMIT ${safeLimit}
  `;

  return db.prepare(sql).all(params);
}

export function insertSimulatedWebhook({
  eventId,
  type,
  account = null,
  status = 'processed',
  error = null,
  source = 'simulator',
  payload = null
}) {
  const result = beginWebhookEvent({
    eventId,
    type,
    account,
    source,
    payload
  });

  if (result.duplicate) return result.event;

  if (status === 'failed') return markWebhookFailed(eventId, error || 'Simulated processing error');
  return markWebhookProcessed(eventId);
}


// ---- Rental inventory / availability ----
const upsertListingStmt = db.prepare(`
  INSERT INTO rental_listings (listing_id, owner_email, title, total_quantity, cancellation_policy)
  VALUES (@listing_id, @owner_email, @title, @total_quantity, @cancellation_policy)
  ON CONFLICT(listing_id) DO UPDATE SET
    owner_email=excluded.owner_email,
    title=excluded.title,
    total_quantity=excluded.total_quantity,
    cancellation_policy=excluded.cancellation_policy
`);

const listingStmt = db.prepare(`
  SELECT listing_id AS listingId, owner_email AS ownerEmail, title,
         total_quantity AS totalQuantity,
         cancellation_policy AS cancellationPolicy,
         COALESCE(moderation_status,'active') AS moderationStatus
  FROM rental_listings WHERE listing_id = ?
`);

const overlappingBookedStmt = db.prepare(`
  SELECT COALESCE(SUM(quantity), 0) AS booked
  FROM rental_bookings
  WHERE listing_id = @listing_id
    AND (
      status IN ('confirmed','active')
      OR (
        status='pending'
        AND (
          payment_status='paid'
          OR expires_at IS NULL
          OR expires_at > @now
        )
      )
    )
    AND NOT (end_date <= @start_date OR start_date >= @end_date)
`);

const insertRentalBookingStmt = db.prepare(`
  INSERT INTO rental_bookings (
    booking_id, listing_id, start_date, end_date, quantity, status, created_at,
    customer_name, customer_email, customer_phone, accommodation_name,
    delivery_city, delivery_address, room_number, contact_person,
    delivery_instructions, order_value, payment_token_hash, expires_at
  )
  VALUES (
    @booking_id, @listing_id, @start_date, @end_date, @quantity, @status, @created_at,
    @customer_name, @customer_email, @customer_phone, @accommodation_name,
    @delivery_city, @delivery_address, @room_number, @contact_person,
    @delivery_instructions, @order_value, @payment_token_hash, @expires_at
  )
`);

const rentalBookingStmt = db.prepare(`
  SELECT booking_id AS bookingId, listing_id AS listingId, start_date AS startDate,
         end_date AS endDate, quantity, status, created_at AS createdAt,
         updated_at AS updatedAt, cancelled_at AS cancelledAt,
         returned_at AS returnedAt, cancellation_reason AS cancellationReason,
         customer_name AS customerName, customer_email AS customerEmail,
         customer_phone AS customerPhone, accommodation_name AS accommodationName,
         delivery_city AS deliveryCity, delivery_address AS deliveryAddress,
         room_number AS roomNumber, contact_person AS contactPerson,
         delivery_instructions AS deliveryInstructions, order_value AS orderValue,
         refund_amount AS refundAmount,
         return_condition AS returnCondition,
         return_notes AS returnNotes,
         stripe_payment_intent_id AS stripePaymentIntentId,
         payment_status AS paymentStatus,
         platform_fee_amount AS platformFeeAmount,
         supplier_amount AS supplierAmount,
         security_deposit_amount AS securityDepositAmount,
         security_deposit_status AS securityDepositStatus,
         security_deposit_resolution AS securityDepositResolution,
         security_deposit_resolved_at AS securityDepositResolvedAt,
         security_deposit_payment_intent_id AS securityDepositPaymentIntentId,
         security_deposit_provider_status AS securityDepositProviderStatus,
         expires_at AS expiresAt,
         stripe_refund_id AS stripeRefundId,
         refund_status AS refundStatus
  FROM rental_bookings
  WHERE booking_id = ?
`);

const updateRentalBookingStatusStmt = db.prepare(`
  UPDATE rental_bookings
  SET status = @status,
      updated_at = @updated_at,
      cancelled_at = CASE WHEN @status = 'cancelled' THEN @updated_at ELSE cancelled_at END,
      returned_at = CASE WHEN @status IN ('returned','completed') THEN @updated_at ELSE returned_at END,
      cancellation_reason = CASE WHEN @status = 'cancelled' THEN @reason ELSE cancellation_reason END
  WHERE booking_id = @booking_id
`);

const listRentalBookingsStmt = db.prepare(`
  SELECT rb.booking_id AS bookingId,
         rb.listing_id AS listingId,
         rb.start_date AS startDate,
         rb.end_date AS endDate,
         rb.quantity,
         rb.status,
         rb.created_at AS createdAt,
         rb.updated_at AS updatedAt,
         rb.cancelled_at AS cancelledAt,
         rb.returned_at AS returnedAt,
         rb.cancellation_reason AS cancellationReason,
         rb.customer_name AS customerName,
         rb.customer_email AS customerEmail,
         rb.customer_phone AS customerPhone,
         rb.accommodation_name AS accommodationName,
         rb.delivery_city AS deliveryCity,
         rb.delivery_address AS deliveryAddress,
         rb.room_number AS roomNumber,
         rb.contact_person AS contactPerson,
         rb.delivery_instructions AS deliveryInstructions,
         rb.order_value AS orderValue,
         rb.refund_amount AS refundAmount,
         rb.return_condition AS returnCondition,
         rb.return_notes AS returnNotes,
         rb.stripe_payment_intent_id AS stripePaymentIntentId,
         rb.payment_status AS paymentStatus,
         rb.platform_fee_amount AS platformFeeAmount,
         rb.supplier_amount AS supplierAmount,
         rb.expires_at AS expiresAt,
         rb.stripe_refund_id AS stripeRefundId,
         rb.refund_status AS refundStatus,
         rl.title,
         rl.owner_email AS ownerEmail,
         rl.total_quantity AS totalQuantity
  FROM rental_bookings rb
  JOIN rental_listings rl ON rl.listing_id = rb.listing_id
  WHERE (@owner_email IS NULL OR rl.owner_email = @owner_email)
  ORDER BY rb.start_date ASC, rb.created_at DESC
`);

export function upsertRentalListing({ listingId, ownerEmail=null, title, totalQuantity, cancellationPolicy='moderate' }) {
  upsertListingStmt.run({
    listing_id: String(listingId),
    owner_email: ownerEmail,
    title: title || 'Rental item',
    total_quantity: Number(totalQuantity || 0),
    cancellation_policy: cancellationPolicy || 'moderate'
  });
  return listingStmt.get(String(listingId));
}

export function getRentalListing(listingId) {
  return listingStmt.get(String(listingId)) || null;
}

export function getAvailability({ listingId, startDate, endDate, requestedQuantity=1 }) {
  expireStalePendingBookings();
  const listing = getRentalListing(listingId);
  if (!listing) return null;
  if (listing.moderationStatus !== 'active') {
    return {listingId:String(listingId),totalQuantity:Number(listing.totalQuantity||0),bookedQuantity:0,remainingQuantity:0,requestedQuantity:Number(requestedQuantity||1),available:false,unavailableReason:'listing_not_active'};
  }

  const row = overlappingBookedStmt.get({
    listing_id: String(listingId),
    start_date: startDate,
    end_date: endDate,
    now: new Date().toISOString()
  });
  const booked = Number(row?.booked || 0);
  const remaining = Math.max(0, Number(listing.totalQuantity) - booked);

  return {
    listingId: String(listingId),
    totalQuantity: Number(listing.totalQuantity),
    bookedQuantity: booked,
    remainingQuantity: remaining,
    requestedQuantity: Number(requestedQuantity || 1),
    available: remaining >= Number(requestedQuantity || 1)
  };
}

export function createRentalBookingAtomic({
  bookingId,
  listingId,
  startDate,
  endDate,
  quantity,
  status='pending',
  customerName=null,
  customerEmail=null,
  customerPhone=null,
  accommodationName=null,
  deliveryCity=null,
  deliveryAddress=null,
  roomNumber=null,
  contactPerson=null,
  deliveryInstructions=null,
  orderValue=null,
  holdMinutes=30
}) {
  const paymentToken=crypto.randomBytes(24).toString('hex');
  const paymentTokenHash=crypto.createHash('sha256').update(paymentToken).digest('hex');
  const expiresAt=new Date(Date.now()+Math.max(5,Number(holdMinutes||30))*60000).toISOString();

  const tx = db.transaction(() => {
    const listing = getRentalListing(listingId);
    if (!listing) throw new Error('Listing not found');
    if (listing.moderationStatus !== 'active') {
      const err=new Error('Listing is not available for booking'); err.code='LISTING_NOT_ACTIVE'; throw err;
    }

    const availability = getAvailability({
      listingId,
      startDate,
      endDate,
      requestedQuantity: quantity
    });

    if (!availability.available) {
      const err = new Error(`Only ${availability.remainingQuantity} unit(s) available for selected dates`);
      err.code = 'INSUFFICIENT_AVAILABILITY';
      err.availability = availability;
      throw err;
    }

    insertRentalBookingStmt.run({
      booking_id: bookingId,
      listing_id: String(listingId),
      start_date: startDate,
      end_date: endDate,
      quantity: Number(quantity),
      status,
      created_at: new Date().toISOString(),
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      accommodation_name: accommodationName,
      delivery_city: deliveryCity,
      delivery_address: deliveryAddress,
      room_number: roomNumber,
      contact_person: contactPerson,
      delivery_instructions: deliveryInstructions,
      order_value: orderValue == null ? null : Number(orderValue),
      payment_token_hash: paymentTokenHash,
      expires_at: expiresAt
    });

    return {
      booking: rentalBookingStmt.get(bookingId),
      paymentToken,
      availabilityAfter: getAvailability({
        listingId,
        startDate,
        endDate,
        requestedQuantity: 1
      })
    };
  });

  return tx();
}

const ALLOWED_BOOKING_STATUSES = new Set([
  'pending','confirmed','active','returned','completed','cancelled','declined','expired'
]);

const ALLOWED_TRANSITIONS = {
  pending: new Set(['confirmed','declined','cancelled']),
  confirmed: new Set(['active','cancelled']),
  active: new Set(['returned','completed']),
  returned: new Set(['completed']),
  completed: new Set([]),
  cancelled: new Set([]),
  declined: new Set([]),
  expired: new Set([])
};

export function updateRentalBookingStatus(bookingId, status, reason = null) {
  const booking = rentalBookingStmt.get(bookingId);
  if (!booking) return null;

  if (!ALLOWED_BOOKING_STATUSES.has(status)) {
    const err = new Error('Invalid booking status');
    err.code = 'INVALID_STATUS';
    throw err;
  }

  if (booking.status !== status && !ALLOWED_TRANSITIONS[booking.status]?.has(status)) {
    const err = new Error(`Cannot change booking from ${booking.status} to ${status}`);
    err.code = 'INVALID_TRANSITION';
    throw err;
  }

  updateRentalBookingStatusStmt.run({
    booking_id: bookingId,
    status,
    updated_at: new Date().toISOString(),
    reason
  });
  return rentalBookingStmt.get(bookingId) || null;
}

export function listRentalBookings({ ownerEmail = null } = {}) {
  expireStalePendingBookings();
  return listRentalBookingsStmt.all({ owner_email: ownerEmail || null });
}

export function getAvailabilityCalendar({ listingId, fromDate, toDate }) {
  const listing = getRentalListing(listingId);
  if (!listing) return null;

  const start = new Date(fromDate + 'T00:00:00Z');
  const end = new Date(toDate + 'T00:00:00Z');
  const days = [];

  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayStart = d.toISOString().slice(0,10);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate()+1);
    const dayEnd = next.toISOString().slice(0,10);

    const a = getAvailability({
      listingId,
      startDate: dayStart,
      endDate: dayEnd,
      requestedQuantity: 1
    });

    days.push({
      date: dayStart,
      totalQuantity: a.totalQuantity,
      bookedQuantity: a.bookedQuantity,
      remainingQuantity: a.remainingQuantity
    });
  }

  return { listingId: String(listingId), days };
}


db.exec(`
  CREATE TABLE IF NOT EXISTS rental_reviews (
    review_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL,
    customer_name TEXT,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES rental_bookings(booking_id),
    FOREIGN KEY(listing_id) REFERENCES rental_listings(listing_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rental_reviews_listing
    ON rental_reviews(listing_id);
`);

for (const sql of [
  `ALTER TABLE rental_listings ADD COLUMN cancellation_policy TEXT DEFAULT 'moderate'`,
  `ALTER TABLE rental_bookings ADD COLUMN refund_amount REAL`,
  `ALTER TABLE rental_bookings ADD COLUMN return_condition TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN return_notes TEXT`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}


const setRefundStmt = db.prepare(`
  UPDATE rental_bookings
  SET refund_amount=@refund_amount,
      cancellation_reason=@reason,
      cancelled_at=@now,
      updated_at=@now,
      status='cancelled'
  WHERE booking_id=@booking_id
`);

const setReturnStmt = db.prepare(`
  UPDATE rental_bookings
  SET return_condition=@condition,
      return_notes=@notes,
      returned_at=@now,
      updated_at=@now,
      status='returned'
  WHERE booking_id=@booking_id
`);

const insertReviewStmt = db.prepare(`
  INSERT INTO rental_reviews
    (review_id, booking_id, listing_id, customer_name, rating, comment, created_at)
  VALUES
    (@review_id, @booking_id, @listing_id, @customer_name, @rating, @comment, @created_at)
`);

const listReviewsStmt = db.prepare(`
  SELECT review_id AS reviewId, booking_id AS bookingId, listing_id AS listingId,
         customer_name AS customerName, rating, comment, created_at AS createdAt
  FROM rental_reviews
  WHERE listing_id=?
  ORDER BY created_at DESC
`);

const ratingSummaryStmt = db.prepare(`
  SELECT COUNT(*) AS reviewCount, ROUND(AVG(rating),2) AS averageRating
  FROM rental_reviews
  WHERE listing_id=?
`);

export function calculateRefundAmount(booking, policy, now = new Date()) {
  const value = Number(booking?.orderValue || 0);
  if (!value) return 0;

  const start = new Date(booking.startDate + 'T00:00:00Z');
  const hoursUntil = (start - now) / 3600000;

  if (policy === 'flexible') {
    if (hoursUntil >= 24) return value;
    if (hoursUntil > 0) return value * 0.5;
    return 0;
  }

  if (policy === 'strict') {
    if (hoursUntil >= 168) return value * 0.5;
    return 0;
  }

  // moderate
  if (hoursUntil >= 72) return value;
  if (hoursUntil >= 24) return value * 0.5;
  return 0;
}

export function cancelRentalBookingWithRefund(bookingId, reason = null, now = new Date()) {
  const booking = rentalBookingStmt.get(bookingId);
  if (!booking) return null;
  if (!['pending','confirmed'].includes(booking.status)) {
    const err = new Error(`Cannot cancel booking with status ${booking.status}`);
    err.code='INVALID_TRANSITION';
    throw err;
  }
  const listing=getRentalListing(booking.listingId);
  const policy=listing?.cancellationPolicy || 'moderate';
  const refund=calculateRefundAmount(booking, policy, now);

  setRefundStmt.run({
    booking_id: bookingId,
    refund_amount: refund,
    reason,
    now: now.toISOString()
  });

  return {
    booking: rentalBookingStmt.get(bookingId),
    cancellationPolicy: policy,
    refundAmount: refund
  };
}

export function markRentalReturned(bookingId, condition='good', notes=null) {
  const booking=rentalBookingStmt.get(bookingId);
  if (!booking) return null;
  if (booking.status !== 'active') {
    const err = new Error(`Cannot return booking with status ${booking.status}`);
    err.code='INVALID_TRANSITION';
    throw err;
  }
  const safeCondition=String(condition||'good').trim().toLowerCase();
  if(!new Set(['good','damaged','missing']).has(safeCondition)){
    const err=new Error('Return condition must be good, damaged or missing'); err.code='INVALID_RETURN_CONDITION'; throw err;
  }
  const safeNotes=notes==null?null:String(notes).trim();
  if(safeNotes && safeNotes.length>3000){ const err=new Error('Return notes are too long'); err.code='INVALID_RETURN_NOTES'; throw err; }
  const now=new Date().toISOString();
  setReturnStmt.run({booking_id:bookingId,condition:safeCondition,notes:safeNotes,now});
  return rentalBookingStmt.get(bookingId);
}

const resolveSecurityDepositStmt=db.prepare(`
  UPDATE rental_bookings
  SET security_deposit_status=@status,
      security_deposit_resolution=@resolution,
      security_deposit_resolved_at=@now,
      updated_at=@now
  WHERE booking_id=@booking_id
`);

const setSecurityDepositProviderStmt=db.prepare(`UPDATE rental_bookings SET security_deposit_payment_intent_id=@payment_intent_id,security_deposit_provider_status=@provider_status,security_deposit_status=@deposit_status,updated_at=@now WHERE booking_id=@booking_id`);
export function setRentalSecurityDepositProviderState(bookingId,{paymentIntentId,providerStatus,depositStatus}){
  setSecurityDepositProviderStmt.run({booking_id:bookingId,payment_intent_id:paymentIntentId||null,provider_status:providerStatus||null,deposit_status:depositStatus||'required',now:new Date().toISOString()});
  return rentalBookingStmt.get(bookingId);
}
export function resolveRentalSecurityDeposit(bookingId,{status,resolution=null}={}){
  const booking=rentalBookingStmt.get(bookingId);
  if(!booking) return null;
  const amount=Math.max(0,Number(booking.securityDepositAmount||0));
  if(amount<=0) return booking;
  const safeStatus=String(status||'').trim().toLowerCase();
  if(!new Set(['release_pending','claim_pending','released','captured']).has(safeStatus)){
    const err=new Error('Invalid security deposit resolution');err.code='INVALID_DEPOSIT_RESOLUTION';throw err;
  }
  const safeResolution=resolution==null?null:String(resolution).trim().slice(0,3000);
  const now=new Date().toISOString();
  resolveSecurityDepositStmt.run({booking_id:bookingId,status:safeStatus,resolution:safeResolution,now});
  return rentalBookingStmt.get(bookingId);
}

export function createRentalReview({ bookingId, rating, comment=null }) {
  const booking=rentalBookingStmt.get(bookingId);
  if (!booking) {
    const err=new Error('Booking not found');
    err.code='BOOKING_NOT_FOUND';
    throw err;
  }
  if (!['returned','completed'].includes(booking.status)) {
    const err=new Error('Review is allowed only after return/completion');
    err.code='REVIEW_NOT_ALLOWED';
    throw err;
  }

  const reviewId=`RV-${crypto.randomUUID()}`;
  try{
    insertReviewStmt.run({
      review_id:reviewId,
      booking_id:bookingId,
      listing_id:booking.listingId,
      customer_name:booking.customerName || 'Customer',
      rating:Number(rating),
      comment,
      created_at:new Date().toISOString()
    });
  }catch(err){
    if(String(err.message||'').includes('UNIQUE constraint failed: rental_reviews.booking_id')){
      const conflict=new Error('This booking has already been reviewed');
      conflict.code='REVIEW_ALREADY_EXISTS';
      throw conflict;
    }
    throw err;
  }
  const review=listReviewsStmt.all(String(booking.listingId))
    .find(r=>r.reviewId===reviewId) || null;
  return {
    review,
    summary:ratingSummaryStmt.get(booking.listingId)
  };
}

export function listRentalReviews(listingId) {
  return {
    reviews:listReviewsStmt.all(String(listingId)),
    summary:ratingSummaryStmt.get(String(listingId))
  };
}


db.exec(`
  CREATE TABLE IF NOT EXISTS rental_disputes (
    dispute_id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    opened_by TEXT,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolution TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY(booking_id) REFERENCES rental_bookings(booking_id)
  );

  CREATE TABLE IF NOT EXISTS moderation_actions (
    action_id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL
  );
`);

for (const sql of [
  `ALTER TABLE rental_listings ADD COLUMN moderation_status TEXT DEFAULT 'active'`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}


const createDisputeStmt=db.prepare(`
  INSERT INTO rental_disputes
    (dispute_id, booking_id, opened_by, reason, details, status, created_at)
  VALUES
    (@dispute_id,@booking_id,@opened_by,@reason,@details,'open',@created_at)
`);

const listDisputesStmt=db.prepare(`
  SELECT dispute_id AS disputeId, booking_id AS bookingId, opened_by AS openedBy,
         reason, details, status, resolution, created_at AS createdAt,
         resolved_at AS resolvedAt
  FROM rental_disputes
  ORDER BY created_at DESC
`);

const resolveDisputeStmt=db.prepare(`
  UPDATE rental_disputes
  SET status='resolved', resolution=@resolution, resolved_at=@resolved_at
  WHERE dispute_id=@dispute_id
`);

const moderationActionStmt=db.prepare(`
  INSERT INTO moderation_actions
    (action_id, entity_type, entity_id, action, reason, created_at)
  VALUES
    (@action_id,@entity_type,@entity_id,@action,@reason,@created_at)
`);

const listingModerationStmt=db.prepare(`
  UPDATE rental_listings SET moderation_status=@status WHERE listing_id=@listing_id
`);

const listAllListingsStmt=db.prepare(`
  SELECT listing_id AS listingId, owner_email AS ownerEmail, title,
         total_quantity AS totalQuantity, cancellation_policy AS cancellationPolicy,
         moderation_status AS moderationStatus
  FROM rental_listings
  ORDER BY title
`);

export function createRentalDispute({bookingId,openedBy='customer',reason,details=null}){
  const booking=rentalBookingStmt.get(bookingId);
  if(!booking){
    const err=new Error('Booking not found'); err.code='BOOKING_NOT_FOUND'; throw err;
  }
  const disputeId=`DP-${crypto.randomUUID()}`;
  const existing=listDisputesStmt.all().find(d=>d.bookingId===bookingId && d.status==='open');
  if(existing){ const err=new Error('An open dispute already exists for this booking'); err.code='DISPUTE_ALREADY_OPEN'; throw err; }
  createDisputeStmt.run({
    dispute_id:disputeId,
    booking_id:bookingId,
    opened_by:openedBy,
    reason,
    details,
    created_at:new Date().toISOString()
  });
  return listDisputesStmt.all().find(d=>d.disputeId===disputeId);
}

export function listRentalDisputes(){ return listDisputesStmt.all(); }

export function resolveRentalDispute(disputeId,resolution){
  const current=listDisputesStmt.all().find(d=>d.disputeId===disputeId)||null;
  if(!current) return null;
  if(current.status!=='open'){ const err=new Error('Dispute is already resolved'); err.code='DISPUTE_ALREADY_RESOLVED'; throw err; }
  const safeResolution=String(resolution||'').trim();
  if(!safeResolution || safeResolution.length>5000){ const err=new Error('Resolution must be 1–5000 characters'); err.code='INVALID_DISPUTE_RESOLUTION'; throw err; }
  resolveDisputeStmt.run({dispute_id:disputeId,resolution:safeResolution,resolved_at:new Date().toISOString()});
  return listDisputesStmt.all().find(d=>d.disputeId===disputeId)||null;
}

export function setListingModerationStatus(listingId,status,reason=null){
  const allowed=new Set(['active','paused','blocked']);
  if(!allowed.has(status)) throw new Error('Invalid moderation status');
  listingModerationStmt.run({listing_id:String(listingId),status});
  moderationActionStmt.run({
    action_id:`MA-${crypto.randomUUID()}`,
    entity_type:'listing',
    entity_id:String(listingId),
    action:status,
    reason,
    created_at:new Date().toISOString()
  });
  return listAllListingsStmt.all().find(l=>String(l.listingId)===String(listingId))||null;
}

export function getAdminDashboardData(){
  const listings=listAllListingsStmt.all();
  const bookings=listRentalBookings({});
  const disputes=listDisputesStmt.all();
  return {
    kpis:{
      listings:listings.length,
      activeListings:listings.filter(l=>l.moderationStatus==='active').length,
      bookings:bookings.length,
      openDisputes:disputes.filter(d=>d.status==='open').length,
      gmv:bookings.reduce((s,b)=>s+Number(b.orderValue||0),0)
    },
    listings,
    bookings,
    disputes
  };
}


const listCustomerBookingsStmt=db.prepare(`
  SELECT rb.booking_id AS bookingId,
         rb.listing_id AS listingId,
         rb.start_date AS startDate,
         rb.end_date AS endDate,
         rb.quantity,
         rb.status,
         rb.created_at AS createdAt,
         rb.customer_name AS customerName,
         rb.customer_email AS customerEmail,
         rb.customer_phone AS customerPhone,
         rb.accommodation_name AS accommodationName,
         rb.delivery_city AS deliveryCity,
         rb.delivery_address AS deliveryAddress,
         rb.room_number AS roomNumber,
         rb.contact_person AS contactPerson,
         rb.delivery_instructions AS deliveryInstructions,
         rb.order_value AS orderValue,
         rb.refund_amount AS refundAmount,
         rb.return_condition AS returnCondition,
         rb.return_notes AS returnNotes,
         rb.stripe_payment_intent_id AS stripePaymentIntentId,
         rb.payment_status AS paymentStatus,
         rb.platform_fee_amount AS platformFeeAmount,
         rb.supplier_amount AS supplierAmount,
         rl.title,
         rl.cancellation_policy AS cancellationPolicy
  FROM rental_bookings rb
  JOIN rental_listings rl ON rl.listing_id=rb.listing_id
  WHERE LOWER(COALESCE(rb.customer_email,''))=LOWER(@customer_email)
  ORDER BY rb.created_at DESC
`);

export function listCustomerRentalBookings(customerEmail){
  if(!customerEmail) return [];
  return listCustomerBookingsStmt.all({customer_email:customerEmail});
}


db.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('customer','supplier','admin')),
    display_name TEXT,
    business_name TEXT,
    country TEXT,
    city TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_sessions (
    session_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES app_users(user_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id);
`);

for (const sql of [
  `ALTER TABLE rental_listings ADD COLUMN data_json TEXT`,
  `ALTER TABLE rental_listings ADD COLUMN created_at TEXT`,
  `ALTER TABLE rental_listings ADD COLUMN updated_at TEXT`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}


function hashPassword(password, saltHex){
  const salt=Buffer.from(saltHex,'hex');
  return crypto.scryptSync(String(password),salt,64).toString('hex');
}

function publicUser(row){
  if(!row) return null;
  return {
    userId:row.user_id,
    email:row.email,
    role:row.role,
    displayName:row.display_name,
    businessName:row.business_name,
    country:row.country,
    city:row.city,
    createdAt:row.created_at
  };
}

const insertUserStmt=db.prepare(`
  INSERT INTO app_users
    (user_id,email,password_salt,password_hash,role,display_name,business_name,country,city,created_at,updated_at)
  VALUES
    (@user_id,@email,@password_salt,@password_hash,@role,@display_name,@business_name,@country,@city,@created_at,@updated_at)
`);

const userByEmailStmt=db.prepare(`SELECT * FROM app_users WHERE email=? COLLATE NOCASE`);
const userByIdStmt=db.prepare(`SELECT * FROM app_users WHERE user_id=?`);

const insertSessionStmt=db.prepare(`
  INSERT INTO app_sessions (session_hash,user_id,created_at,expires_at)
  VALUES (@session_hash,@user_id,@created_at,@expires_at)
`);
const sessionUserStmt=db.prepare(`
  SELECT u.*
  FROM app_sessions s
  JOIN app_users u ON u.user_id=s.user_id
  WHERE s.session_hash=? AND s.expires_at>?
`);
const deleteSessionStmt=db.prepare(`DELETE FROM app_sessions WHERE session_hash=?`);

const upsertFullListingStmt=db.prepare(`
  INSERT INTO rental_listings (
    listing_id,owner_email,title,total_quantity,cancellation_policy,
    moderation_status,data_json,created_at,updated_at
  )
  VALUES (
    @listing_id,@owner_email,@title,@total_quantity,@cancellation_policy,
    @moderation_status,@data_json,@created_at,@updated_at
  )
  ON CONFLICT(listing_id) DO UPDATE SET
    owner_email=excluded.owner_email,
    title=excluded.title,
    total_quantity=excluded.total_quantity,
    cancellation_policy=excluded.cancellation_policy,
    moderation_status=excluded.moderation_status,
    data_json=excluded.data_json,
    updated_at=excluded.updated_at
`);

const listPublicFullListingsStmt=db.prepare(`
  SELECT data_json
  FROM rental_listings
  WHERE COALESCE(moderation_status,'active')='active'
  ORDER BY COALESCE(updated_at,created_at) DESC
`);

const listOwnerFullListingsStmt=db.prepare(`
  SELECT data_json
  FROM rental_listings
  WHERE owner_email=? COLLATE NOCASE
  ORDER BY COALESCE(updated_at,created_at) DESC
`);

const deleteOwnerListingStmt=db.prepare(`
  DELETE FROM rental_listings WHERE listing_id=? AND owner_email=? COLLATE NOCASE
`);

export function createAppUser({
  email,password,role='supplier',displayName=null,businessName=null,country=null,city=null
}){
  const normalized=String(email||'').trim().toLowerCase();
  if(!normalized || !String(password||'').length) throw new Error('Email and password are required');
  if(!['customer','supplier','admin'].includes(role)) throw new Error('Invalid role');
  if(userByEmailStmt.get(normalized)){
    const err=new Error('Email already registered'); err.code='EMAIL_EXISTS'; throw err;
  }

  const salt=crypto.randomBytes(16).toString('hex');
  const now=new Date().toISOString();
  const userId=`USR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  insertUserStmt.run({
    user_id:userId,
    email:normalized,
    password_salt:salt,
    password_hash:hashPassword(password,salt),
    role,
    display_name:displayName,
    business_name:businessName,
    country,
    city,
    created_at:now,
    updated_at:now
  });
  return publicUser(userByIdStmt.get(userId));
}

export function authenticateAppUser(email,password){
  const row=userByEmailStmt.get(String(email||'').trim().toLowerCase());
  if(!row) return null;
  const supplied=Buffer.from(hashPassword(password,row.password_salt),'hex');
  const expected=Buffer.from(row.password_hash,'hex');
  if(supplied.length!==expected.length || !crypto.timingSafeEqual(supplied,expected)) return null;
  return publicUser(row);
}

export function createAppSession(userId,{days=14}={}){
  const token=crypto.randomBytes(32).toString('hex');
  const sessionHash=crypto.createHash('sha256').update(token).digest('hex');
  const created=new Date();
  const expires=new Date(created.getTime()+days*86400000);
  insertSessionStmt.run({
    session_hash:sessionHash,
    user_id:userId,
    created_at:created.toISOString(),
    expires_at:expires.toISOString()
  });
  return {token,expiresAt:expires.toISOString()};
}

export function getAppUserBySessionToken(token){
  if(!token) return null;
  const hash=crypto.createHash('sha256').update(String(token)).digest('hex');
  return publicUser(sessionUserStmt.get(hash,new Date().toISOString()));
}

export function deleteAppSession(token){
  if(!token) return;
  const hash=crypto.createHash('sha256').update(String(token)).digest('hex');
  deleteSessionStmt.run(hash);
}

export function seedDefaultUsers(){
  const seeds=[
    {email:'demo@rentall.test',password:'demo123',role:'supplier',displayName:'Demo Supplier',businessName:'RentAll Demo Rentals',country:'LT',city:'Klaipėda'},
    {email:'admin@rentall.test',password:'admin123',role:'admin',displayName:'RentAll Admin',businessName:'RentAll',country:'LT',city:'Vilnius'}
  ];
  for(const s of seeds){
    if(!userByEmailStmt.get(s.email)) createAppUser(s);
  }
}

function parseListingRow(row){
  if(!row?.data_json) return null;
  try{return JSON.parse(row.data_json);}catch{return null;}
}

export function saveFullRentalListing(listing, ownerEmail){
  const now=new Date().toISOString();
  const id=String(listing.id||listing.listingId||`L-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
  const normalized={
    ...listing,
    id,
    ownerEmail:String(ownerEmail||listing.ownerEmail||'').toLowerCase(),
    moderationStatus:listing.moderationStatus||'active'
  };

  upsertFullListingStmt.run({
    listing_id:id,
    owner_email:normalized.ownerEmail,
    title:normalized.title||'Rental item',
    total_quantity:Number(normalized.quantity||0),
    cancellation_policy:normalized.cancellationPolicy||'moderate',
    moderation_status:normalized.moderationStatus,
    data_json:JSON.stringify(normalized),
    created_at:listing.createdAt||now,
    updated_at:now
  });
  return normalized;
}

export function getFullRentalListing(listingId){
  const row=db.prepare(`SELECT data_json FROM rental_listing_details WHERE listing_id=?`).get(String(listingId));
  return parseListingRow(row);
}

export function listPublicRentalListings(){
  return listPublicFullListingsStmt.all().map(parseListingRow).filter(Boolean);
}

export function listOwnerRentalListings(ownerEmail){
  return listOwnerFullListingsStmt.all(String(ownerEmail||'')).map(parseListingRow).filter(Boolean);
}

export function deleteOwnerRentalListing(listingId,ownerEmail){
  const result=deleteOwnerListingStmt.run(String(listingId),String(ownerEmail||''));
  return result.changes>0;
}


db.exec(`
  CREATE TABLE IF NOT EXISTS stripe_connections (
    user_id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    stripe_account_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

for (const sql of [
  `ALTER TABLE stripe_connections ADD COLUMN connect_api TEXT`,
  `ALTER TABLE stripe_connections ADD COLUMN transfer_capability_status TEXT DEFAULT 'unknown'`,
  `ALTER TABLE stripe_connections ADD COLUMN requirements_json TEXT DEFAULT '[]'`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}

for (const sql of [
  `ALTER TABLE rental_bookings ADD COLUMN payment_token_hash TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN stripe_payment_intent_id TEXT`,
  `ALTER TABLE rental_bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`,
  `ALTER TABLE rental_bookings ADD COLUMN platform_fee_amount REAL`,
  `ALTER TABLE rental_bookings ADD COLUMN supplier_amount REAL`
]) {
  try { db.exec(sql); } catch (err) {
    if (!String(err.message).includes('duplicate column name')) throw err;
  }
}


const upsertStripeConnectionStmt=db.prepare(`
  INSERT INTO stripe_connections (user_id,user_email,stripe_account_id,connect_api,transfer_capability_status,requirements_json,created_at,updated_at)
  VALUES (@user_id,@user_email,@stripe_account_id,@connect_api,@transfer_capability_status,@requirements_json,@created_at,@updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    user_email=excluded.user_email,
    stripe_account_id=excluded.stripe_account_id,
    connect_api=COALESCE(excluded.connect_api,stripe_connections.connect_api),
    transfer_capability_status=COALESCE(excluded.transfer_capability_status,stripe_connections.transfer_capability_status),
    requirements_json=COALESCE(excluded.requirements_json,stripe_connections.requirements_json),
    updated_at=excluded.updated_at
`);
const stripeConnectionByUserStmt=db.prepare(`
  SELECT user_id AS userId,user_email AS userEmail,stripe_account_id AS stripeAccountId,
         connect_api AS connectApi,transfer_capability_status AS transferCapabilityStatus,
         requirements_json AS requirementsJson,created_at AS createdAt,updated_at AS updatedAt
  FROM stripe_connections WHERE user_id=?
`);
const stripeConnectionByEmailStmt=db.prepare(`
  SELECT user_id AS userId,user_email AS userEmail,stripe_account_id AS stripeAccountId,
         connect_api AS connectApi,transfer_capability_status AS transferCapabilityStatus,
         requirements_json AS requirementsJson,created_at AS createdAt,updated_at AS updatedAt
  FROM stripe_connections WHERE user_email=? COLLATE NOCASE
`);

const bookingPaymentTokenStmt=db.prepare(`
  SELECT booking_id AS bookingId,listing_id AS listingId,order_value AS orderValue,
         payment_token_hash AS paymentTokenHash,payment_status AS paymentStatus,
         stripe_payment_intent_id AS stripePaymentIntentId,
         guest_access_revoked_at AS guestAccessRevokedAt
  FROM rental_bookings WHERE booking_id=?
`);

const setBookingPaymentStmt=db.prepare(`
  UPDATE rental_bookings
  SET stripe_payment_intent_id=@payment_intent_id,
      payment_status=@payment_status,
      platform_fee_amount=@platform_fee_amount,
      supplier_amount=@supplier_amount,
      updated_at=@updated_at
  WHERE booking_id=@booking_id
`);

export function saveStripeConnection({userId,userEmail,stripeAccountId,connectApi=null,transferCapabilityStatus='unknown',requirements=[]}){
  const now=new Date().toISOString();
  upsertStripeConnectionStmt.run({
    user_id:userId,user_email:userEmail,stripe_account_id:stripeAccountId,
    connect_api:connectApi,transfer_capability_status:transferCapabilityStatus,
    requirements_json:JSON.stringify(Array.isArray(requirements)?requirements:[]),
    created_at:now,updated_at:now
  });
  return stripeConnectionByUserStmt.get(userId)||null;
}

export function updateStripeConnectionCapability({userId,connectApi='v2_recipient',transferCapabilityStatus='unknown',requirements=[]}){
  const existing=stripeConnectionByUserStmt.get(userId);
  if(!existing) return null;
  return saveStripeConnection({
    userId:existing.userId,userEmail:existing.userEmail,stripeAccountId:existing.stripeAccountId,
    connectApi,transferCapabilityStatus,requirements
  });
}

export function getStripeConnectionByUserId(userId){
  return stripeConnectionByUserStmt.get(userId)||null;
}

export function getStripeConnectionByEmail(email){
  return stripeConnectionByEmailStmt.get(String(email||''))||null;
}

export function verifyBookingPaymentToken(bookingId,token){
  const row=bookingPaymentTokenStmt.get(bookingId);
  if(!row?.paymentTokenHash || row.guestAccessRevokedAt || !token) return null;
  const supplied=crypto.createHash('sha256').update(String(token)).digest('hex');
  const a=Buffer.from(row.paymentTokenHash,'hex');
  const b=Buffer.from(supplied,'hex');
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
  return row;
}

export function revokeBookingGuestAccess(bookingId){
  return db.prepare(`UPDATE rental_bookings SET guest_access_revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE booking_id=? AND guest_access_revoked_at IS NULL`).run(String(bookingId)).changes===1;
}

export function setBookingPaymentDetails({
  bookingId,paymentIntentId,paymentStatus='requires_payment_method',
  platformFeeAmount=0,supplierAmount=0
}){
  setBookingPaymentStmt.run({
    booking_id:bookingId,
    payment_intent_id:paymentIntentId,
    payment_status:paymentStatus,
    platform_fee_amount:Number(platformFeeAmount||0),
    supplier_amount:Number(supplierAmount||0),
    updated_at:new Date().toISOString()
  });
  return rentalBookingStmt.get(bookingId)||null;
}

export function getRentalBookingById(bookingId){
  return rentalBookingStmt.get(bookingId)||null;
}


export function getCustomerBookingByAccessToken(bookingId, accessToken) {
  const paymentRow=verifyBookingPaymentToken(bookingId,accessToken);
  if(!paymentRow) return null;
  const booking=getRentalBookingById(bookingId);
  if(!booking) return null;
  const listing=getRentalListing(booking.listingId);
  return {
    ...booking,
    title:listing?.title || 'Rental item',
    cancellationPolicy:listing?.cancellationPolicy || 'moderate'
  };
}


const expirePendingStmt=db.prepare(`
  UPDATE rental_bookings
  SET status='expired',updated_at=@now
  WHERE status='pending'
    AND COALESCE(payment_status,'unpaid')!='paid'
    AND expires_at IS NOT NULL
    AND expires_at<=@now
`);

const setStripeRefundStmt=db.prepare(`
  UPDATE rental_bookings
  SET stripe_refund_id=@refund_id,
      refund_status=@refund_status,
      refund_amount=CASE WHEN @refund_amount IS NULL THEN refund_amount ELSE @refund_amount END,
      payment_status=CASE
        WHEN @refund_status='succeeded' AND COALESCE(@refund_amount,0)>=order_value THEN 'refunded'
        WHEN @refund_status='succeeded' AND COALESCE(@refund_amount,0)>0 THEN 'partially_refunded'
        ELSE payment_status
      END,
      updated_at=@updated_at
  WHERE booking_id=@booking_id
`);

export function expireStalePendingBookings(now=new Date()){
  const iso=now.toISOString();
  const stale=db.prepare(`SELECT booking_id AS bookingId FROM rental_bookings WHERE status='pending' AND COALESCE(payment_status,'unpaid')!='paid' AND expires_at IS NOT NULL AND expires_at<=?`).all(iso);
  if(stale.length) expirePendingStmt.run({now:iso});
  return stale.map(x=>x.bookingId);
}

export function setStripeRefundDetails(bookingId,{refundId=null,refundStatus=null,refundAmount=null}={}){
  setStripeRefundStmt.run({
    booking_id:bookingId,
    refund_id:refundId,
    refund_status:refundStatus,
    refund_amount:refundAmount==null?null:Math.max(0,Number(refundAmount||0)),
    updated_at:new Date().toISOString()
  });
  return rentalBookingStmt.get(bookingId)||null;
}


const setStatusAfterRefundStmt=db.prepare(`
  UPDATE rental_bookings SET status=@status,updated_at=@updated_at WHERE booking_id=@booking_id
`);

export function setRentalBookingStatusAfterRefund(bookingId,status){
  setStatusAfterRefundStmt.run({
    booking_id:bookingId,
    status,
    updated_at:new Date().toISOString()
  });
  return rentalBookingStmt.get(bookingId)||null;
}


export function claimWebhookRetry(eventId,{staleMinutes=5}={}){
  const event=getWebhookEvent(eventId);
  if(!event) return {claimed:false,event:null};

  const staleBefore=Date.now()-Math.max(1,Number(staleMinutes||5))*60000;
  const processingStarted=event.processingStartedAt
    ? new Date(event.processingStartedAt).getTime()
    : 0;

  const retryable=
    event.status==='failed'
    || (event.status==='processing' && processingStarted && processingStarted<staleBefore);

  if(!retryable) return {claimed:false,event};

  markProcessingStmt.run({
    event_id:eventId,
    processing_started_at:new Date().toISOString()
  });
  return {claimed:true,event:getWebhookEvent(eventId)};
}


db.exec(`
  CREATE TABLE IF NOT EXISTS rental_notifications (
    notification_id TEXT PRIMARY KEY,
    unique_key TEXT UNIQUE,
    audience TEXT NOT NULL,
    user_email TEXT,
    booking_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON rental_notifications(user_email,created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_notifications_booking_created
    ON rental_notifications(booking_id,created_at ASC);
`);


const insertNotificationStmt=db.prepare(`
  INSERT OR IGNORE INTO rental_notifications (
    notification_id,unique_key,audience,user_email,booking_id,type,title,message,created_at,read_at
  ) VALUES (
    @notification_id,@unique_key,@audience,@user_email,@booking_id,@type,@title,@message,@created_at,NULL
  )
`);

const supplierNotificationsStmt=db.prepare(`
  SELECT notification_id AS notificationId,unique_key AS uniqueKey,
         audience,user_email AS userEmail,booking_id AS bookingId,
         type,title,message,created_at AS createdAt,read_at AS readAt
  FROM rental_notifications
  WHERE audience='supplier' AND user_email=? COLLATE NOCASE
  ORDER BY created_at DESC
  LIMIT ?
`);

const bookingNotificationsStmt=db.prepare(`
  SELECT notification_id AS notificationId,audience,user_email AS userEmail,
         booking_id AS bookingId,type,title,message,created_at AS createdAt,read_at AS readAt
  FROM rental_notifications
  WHERE booking_id=?
  ORDER BY created_at ASC
`);

const markNotificationReadStmt=db.prepare(`
  UPDATE rental_notifications SET read_at=@read_at
  WHERE notification_id=@notification_id AND user_email=@user_email COLLATE NOCASE
`);

export function createRentalNotification({
  uniqueKey=null,audience,userEmail=null,bookingId=null,type,title,message
}){
  const id=`NT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  insertNotificationStmt.run({
    notification_id:id,
    unique_key:uniqueKey,
    audience,
    user_email:userEmail,
    booking_id:bookingId,
    type,
    title,
    message,
    created_at:new Date().toISOString()
  });
  return id;
}

export function listCustomerNotifications(userEmail,{limit=100}={}){
  return db.prepare(`SELECT notification_id AS notificationId,audience,user_email AS userEmail,booking_id AS bookingId,type,title,message,created_at AS createdAt,read_at AS readAt FROM rental_notifications WHERE audience='customer' AND user_email=? COLLATE NOCASE ORDER BY created_at DESC LIMIT ?`).all(String(userEmail||''),Math.max(1,Math.min(200,Number(limit||100))));
}
export function markCustomerNotificationRead(notificationId,userEmail){
  markNotificationReadStmt.run({notification_id:notificationId,user_email:userEmail,read_at:new Date().toISOString()});return true;
}

export function listSupplierNotifications(userEmail,{limit=100}={}){
  return supplierNotificationsStmt.all(String(userEmail||''),Math.max(1,Math.min(200,Number(limit||100))));
}

export function listBookingNotifications(bookingId){
  return bookingNotificationsStmt.all(String(bookingId));
}

export function markSupplierNotificationRead(notificationId,userEmail){
  markNotificationReadStmt.run({
    notification_id:notificationId,
    user_email:userEmail,
    read_at:new Date().toISOString()
  });
  return true;
}


db.exec(`
  CREATE TABLE IF NOT EXISTS rental_saved_searches (
    saved_search_id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    name TEXT NOT NULL,
    query_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_saved_searches_user
    ON rental_saved_searches(user_email, updated_at DESC);
`);

const upsertSavedSearchStmt=db.prepare(`
  INSERT INTO rental_saved_searches(saved_search_id,user_email,name,query_json,created_at,updated_at)
  VALUES(@saved_search_id,@user_email,@name,@query_json,@created_at,@updated_at)
  ON CONFLICT(saved_search_id) DO UPDATE SET
    name=excluded.name,
    query_json=excluded.query_json,
    updated_at=excluded.updated_at
`);
const listSavedSearchesStmt=db.prepare(`
  SELECT saved_search_id AS savedSearchId,name,query_json AS queryJson,
         created_at AS createdAt,updated_at AS updatedAt
  FROM rental_saved_searches
  WHERE user_email=? COLLATE NOCASE
  ORDER BY updated_at DESC
`);
const deleteSavedSearchStmt=db.prepare(`
  DELETE FROM rental_saved_searches
  WHERE saved_search_id=@saved_search_id AND user_email=@user_email COLLATE NOCASE
`);

export function saveRentalSearch(userEmail,{savedSearchId=null,name='Saved search',query={}}={}){
  const now=new Date().toISOString();
  const id=savedSearchId||`SS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  upsertSavedSearchStmt.run({
    saved_search_id:id,user_email:userEmail,name:String(name).slice(0,80),
    query_json:JSON.stringify(query||{}),created_at:now,updated_at:now
  });
  return listSavedSearches(userEmail).find(x=>x.savedSearchId===id)||null;
}
export function listSavedSearches(userEmail){
  return listSavedSearchesStmt.all(userEmail).map(x=>{
    try{x.query=JSON.parse(x.queryJson||'{}')}catch{x.query={}}
    delete x.queryJson;
    return x;
  });
}
export function deleteRentalSavedSearch(userEmail,savedSearchId){
  return deleteSavedSearchStmt.run({user_email:userEmail,saved_search_id:savedSearchId}).changes>0;
}


// V54 transactional email outbox: durable queue for production delivery workers.
db.exec(`
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient TEXT NOT NULL,
  template_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON email_outbox(status, created_at);
`);
try{ db.exec(`ALTER TABLE email_outbox ADD COLUMN dedupe_key TEXT`); }catch{}
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_outbox_dedupe_key ON email_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL`);

const enqueueEmailStmt=db.prepare(`
  INSERT OR IGNORE INTO email_outbox(recipient,template_key,subject,payload_json,status,dedupe_key)
  VALUES(?,?,?,?, 'pending',?)
`);
const listEmailOutboxStmt=db.prepare(`
  SELECT id,recipient,template_key AS templateKey,subject,payload_json AS payloadJson,
         status,attempts,last_error AS lastError,created_at AS createdAt,sent_at AS sentAt
  FROM email_outbox
  ORDER BY id DESC
  LIMIT ?
`);

export function enqueueTransactionalEmail({recipient,templateKey,subject,payload={},dedupeKey=null}){
  const email=String(recipient||'').trim().toLowerCase();
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const key=dedupeKey?String(dedupeKey).slice(0,180):null;
  const info=enqueueEmailStmt.run(email,String(templateKey||'generic').slice(0,80),
    String(subject||'RentAll update').slice(0,180),JSON.stringify(payload||{}),key);
  if(info.changes===0 && key){
    return Number(db.prepare(`SELECT id FROM email_outbox WHERE dedupe_key=?`).get(key)?.id||0)||null;
  }
  return Number(info.lastInsertRowid);
}
export function listEmailOutbox(limit=100){
  const safe=Math.max(1,Math.min(200,Number(limit)||100));
  return listEmailOutboxStmt.all(safe).map(row=>({
    ...row,payload:(()=>{try{return JSON.parse(row.payloadJson||'{}')}catch{return {}}})()
  }));
}


const claimPendingEmailStmt=db.prepare(`
  SELECT id,recipient,template_key AS templateKey,subject,payload_json AS payloadJson,
         status,attempts,created_at AS createdAt
  FROM email_outbox
  WHERE status='pending' AND attempts < ?
  ORDER BY id ASC
  LIMIT ?
`);
const markEmailSendingStmt=db.prepare(`
  UPDATE email_outbox
  SET status='sending', attempts=attempts+1, last_error=NULL
  WHERE id=? AND status='pending'
`);
const markEmailSentStmt=db.prepare(`
  UPDATE email_outbox SET status='sent', sent_at=CURRENT_TIMESTAMP, last_error=NULL WHERE id=?
`);
const markEmailFailedStmt=db.prepare(`
  UPDATE email_outbox SET status=?, last_error=? WHERE id=?
`);

export function claimTransactionalEmails({limit=20,maxAttempts=5}={}){
  const safeLimit=Math.max(1,Math.min(100,Number(limit)||20));
  const safeAttempts=Math.max(1,Math.min(20,Number(maxAttempts)||5));
  const candidates=claimPendingEmailStmt.all(safeAttempts,safeLimit);
  const claimed=[];
  const claim=db.transaction(()=>{
    for(const row of candidates){
      const changed=markEmailSendingStmt.run(row.id);
      if(changed.changes===1){
        let payload={}; try{ payload=JSON.parse(row.payloadJson||'{}') }catch{}
        claimed.push({...row,payload,attempts:Number(row.attempts||0)+1,status:'sending'});
      }
    }
  });
  claim();
  return claimed;
}
export function completeTransactionalEmail(id){
  return markEmailSentStmt.run(Number(id)).changes===1;
}
export function failTransactionalEmail(id,error,{maxAttempts=5}={}){
  const row=db.prepare('SELECT attempts FROM email_outbox WHERE id=?').get(Number(id));
  if(!row) return false;
  const terminal=Number(row.attempts)>=Math.max(1,Number(maxAttempts)||5);
  const status=terminal?'failed':'pending';
  return markEmailFailedStmt.run(status,String(error||'Delivery failed').slice(0,1000),Number(id)).changes===1;
}

// V57: durable protection against duplicate booking submissions.
db.exec(`
CREATE TABLE IF NOT EXISTS booking_idempotency (
 idempotency_key TEXT PRIMARY KEY,
 request_hash TEXT NOT NULL,
 response_json TEXT,
 status TEXT NOT NULL DEFAULT 'processing',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 completed_at TEXT
);`);
export function beginBookingIdempotency(key,requestHash){
 const k=String(key||'').trim().slice(0,160);
 if(!k||!requestHash)return {state:'disabled'};
 const inserted=db.prepare(`INSERT OR IGNORE INTO booking_idempotency(idempotency_key,request_hash,status) VALUES(?,?,'processing')`).run(k,String(requestHash));
 let row=db.prepare(`SELECT request_hash requestHash,response_json responseJson,status,created_at createdAt FROM booking_idempotency WHERE idempotency_key=?`).get(k);
 if(row.requestHash!==String(requestHash))return {state:'conflict'};
 if(row.status==='completed'&&row.responseJson){try{return {state:'replay',response:JSON.parse(row.responseJson)}}catch{}}
 if(inserted.changes===0){
   const staleBefore=new Date(Date.now()-10*60*1000).toISOString();
   const reclaimed=db.prepare(`UPDATE booking_idempotency
     SET created_at=CURRENT_TIMESTAMP
     WHERE idempotency_key=? AND request_hash=? AND status='processing' AND datetime(created_at) < datetime(?)`)
     .run(k,String(requestHash),staleBefore);
   if(reclaimed.changes===1) return {state:'processing',reclaimed:true};
   return {state:'in_progress'};
 }
 return {state:'processing'};
}
export function completeBookingIdempotency(key,requestHash,response){
 return db.prepare(`UPDATE booking_idempotency SET response_json=?,status='completed',completed_at=CURRENT_TIMESTAMP WHERE idempotency_key=? AND request_hash=?`)
 .run(JSON.stringify(response||{}),String(key||'').trim().slice(0,160),String(requestHash)).changes===1;
}
export function releaseBookingIdempotency(key,requestHash){
  return db.prepare(`DELETE FROM booking_idempotency
    WHERE idempotency_key=? AND request_hash=? AND status='processing'`)
    .run(String(key||'').trim().slice(0,160),String(requestHash)).changes===1;
}
