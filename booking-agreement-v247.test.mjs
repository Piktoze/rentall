import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POLICY_COPY} from './modules/help-center-content-v177.js';
// Validate that newly-created agreement snapshots contain the essential
// bilateral rights and match the platform's consent/handover controls.
const server=fs.readFileSync('./server.js','utf8');
const db=fs.readFileSync('./db.js','utf8');
const start=server.indexOf('const agreement=createRentalAgreement({');
const end=server.indexOf('if(isEmail(effectiveCustomerEmail))',start);
assert.ok(start>=0&&end>start,'Booking agreement snapshot creation exists');
const booking=server.slice(start,end);
assert.match(booking,/termsVersion:'rentinorbit-rental-v3'/);
for(const term of [
 'Nuomotojas patvirtina, kad turi teisę nuomoti',
 'Nuomininkas naudoja daiktą pagal paskirtį',
 'Abi šalys atskirai patvirtina',
 'Kodas galioja iki panaudojimo',
 'Grąžinimą RentInOrbit sistemoje patvirtina nuomotojas',
 'nepažeidžiant privalomų vartotojų teisių',
 'pateikia turimus įrodymus',
 'Ši sąlyga nepanaikina privalomų teisinių RentInOrbit pareigų'
])assert.ok(booking.includes(term),'Missing booking-specific responsibility clause: '+term);
assert.match(db,/if\(existing\)return publicAgreement\(existing\)/,
 'Already-created agreement must not be overwritten by new version');
assert.match(db,/snapshot_sha256 TEXT NOT NULL/,
 'Acceptance audit must bind signature to immutable agreement snapshot');
assert.match(server,/req\.body\?\.accepted!==true/,
 'Acceptance must be explicit for each party');
assert.match(server,/const customer=!supplier&&\(accountCustomer\|\|guestCustomer\)/,
 'Guest or logged-in customer cannot sign on behalf of supplier');
assert.match(server,/if\(isSupplier\|\|\(!isAccountCustomer&&!isGuestCustomer\)\)/,
 'Supplier cannot obtain renter handover code');
assert.ok(POLICY_COPY.lt.terms.sections.some(([title])=>title.includes('Rezervacija ir sutartis')),
 'LT public terms need a booking agreement section');
console.log('PASS booking agreement v3: bilateral obligations, immutable snapshot, separate signatures, handover and consumer protections');
