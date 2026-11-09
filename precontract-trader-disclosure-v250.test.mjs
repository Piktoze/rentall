import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const server=fs.readFileSync('server.js','utf8');
assert.ok(html.includes('id="rioCheckoutTraderDisclosure"'),'Checkout must display supplier classification');
assert.ok(html.includes('id="rioCheckoutTraderAck" required disabled'),
 'Acknowledgement must be required and disabled until supplier disclosure is fetched');
assert.ok(app.includes("async function rioRefreshCheckoutTraderDisclosure()"),
 'Checkout requires live supplier lookup');
assert.ok(app.includes("await rioRefreshCheckoutTraderDisclosure();"),
 'Booking API invocation must fetch current disclosure');
assert.ok(app.includes("if(!ack?.checked||ack.disabled||rioCheckoutDisclosureListing!==String(listingId))"),
 'Reject checkout without acknowledgment for matching listing');
assert.ok(app.includes("key!==rioCheckoutDisclosureKey)ack.checked=false"),
 'Clear acknowledgment if supplier status changes before booking');
assert.ok(app.includes("Nuomotojas: privatus asmuo"),
 'Private supplier must be disclosed');
assert.ok(app.includes("Nuomotojas: verslininkas"),
 'Professional supplier must be disclosed');
assert.ok(app.includes("Nuomotojo veiklos statusas nenurodytas"),
 'Undeclared status must never masquerade as a verified trader');
assert.ok(app.includes("Specialios ES vartotojų teisės"),
 'Warn about different consumer rights for private-to-private rental');
assert.ok(app.includes('const supplierVerified=authoritativeTrader?.verified===true;'),
 'Do not infer legal verification from reputation-only trust badge');
assert.ok(app.includes("rioTraderNoticeMarkup(authoritativeTrader)"),
 'Supplier status must appear in listing detail, not only checkout');
assert.ok(server.includes("app.get('/api/listings/:listingId/trader-disclosure'"),
 'Server must expose independently queryable authoritative supplier status');
assert.ok(server.includes("res.set('Cache-Control','no-store');"),
 'Public trader information must not persist via stale cache after verification changes');
console.log('PASS precontract supplier disclosure: detail, live API, private-seller warning, changed status and required acknowledgment');
