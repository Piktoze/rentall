import fs from 'fs';

const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const db=fs.readFileSync('./db.js','utf8');
const server=fs.readFileSync('./server.js','utf8');

function assert(v,msg){ if(!v) throw new Error(msg); }

const migrationIndex=db.indexOf('V33: run all schema migrations BEFORE');
const bookingPrepare=db.indexOf('const insertRentalBookingStmt');
assert(migrationIndex>=0 && migrationIndex<bookingPrepare,
  'Critical DB migrations must run before rental booking prepared statements');

assert(server.includes("app.get('/api/rentals/bookings', requireRole('supplier','admin')"),
  'Supplier booking list must require authentication');

assert(server.includes("app.post('/api/rentals/bookings/:bookingId/return', requireRole('supplier','admin')"),
  'Return endpoint must require supplier/admin auth');

assert(server.includes("bookingAccessAllowed(req,req.params.bookingId)"),
  'Cancellation endpoint must enforce booking access');

assert(server.includes("getCustomerBookingByAccessToken"),
  'Customer booking access must use a booking token');

assert(app.includes('wireAuthoritativeCheckout()'),
  'Authoritative checkout must be wired');

assert(app.includes('wireSecureCustomerPortalButtons()'),
  'Secure customer portal buttons must replace legacy handlers');

assert(!app.includes("document.getElementById('customerEmail')"),
  'Non-existent customerEmail field lookup must be removed');

assert(!app.includes("document.getElementById('customerPhone')"),
  'Non-existent customerPhone field lookup must be removed');

console.log('PASS: V33 static audit checks passed.');

assert(server.includes("claimWebhookRetry(event.id"),
  'Webhook duplicates must reclaim failed/stale events for retry');
assert(server.includes("async (req, res) => {"),
  'Stripe webhook handler must be async for refund side effects');
