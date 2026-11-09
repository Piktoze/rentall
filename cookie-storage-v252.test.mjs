import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POLICY_COPY} from './modules/help-center-content-v177.js';

const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const server=fs.readFileSync('server.js','utf8');
const inventory=fs.readFileSync('release/COOKIE_STORAGE_AUDIT_LT.md','utf8');

assert.ok(!html.includes('<script src="https://connect-js.stripe.com/v1.0/connect.js" async>'),
 'Stripe Connect must not contact vendor on every anonymous page load');
const connectStart=app.indexOf('async function waitForStripeConnectJs()');
const onboardingStart=app.indexOf('async function mountStripeEmbeddedOnboarding(',connectStart);
assert.ok(connectStart>=0&&onboardingStart>connectStart);
const onDemand=app.slice(connectStart,onboardingStart);
assert.ok(onDemand.includes("loader=document.createElement('script')")&&
 onDemand.includes("loader.src='https://connect-js.stripe.com/v1.0/connect.js'")&&
 onDemand.includes('document.head.appendChild(loader)'),
 'Stripe Connect should load only when its onboarding function is called');
assert.ok(app.includes('const StripeConnectGlobal=await waitForStripeConnectJs();'),
 'Supplier onboarding must still wait for the Connect library');
assert.ok(app.includes("s.src='https://js.stripe.com/v3/'"),
 'Checkout must retain the dynamically loaded secure Stripe payment library');

assert.ok(app.includes('delete copy.password;'),
 'Historical plaintext browser supplier passwords must be purged on profile read/write');
assert.ok(app.includes('delete copy.iban;')&&app.includes('delete copy.taxId;'),
 'Historical local IBAN/tax ID must continue to be purged');
assert.ok(app.includes("'password' in item"),
 'Historical passwords must trigger immediate sanitization when loaded');
assert.ok(app.includes('JSON.stringify(stripBrowserPayoutIdentifiers(accounts))'),
 'Legacy browser profile writes must pass through privacy sanitizer');

const cookies=POLICY_COPY.lt.cookies;
assert.ok(cookies.sections.some(([heading,lines])=>heading==='Prisijungimo slapukas'&&
 lines.some(line=>line.includes('rentinorbit_session')&&line.includes('HttpOnly'))),
 'Real authentication cookie name and security attributes must be disclosed');
assert.ok(cookies.sections.some(([heading,lines])=>heading==='Trečiųjų šalių ištekliai'&&
 lines.some(line=>line.includes('Stripe Connect'))),
 'Users must be informed about on-demand Stripe integration');
assert.ok(cookies.sections.some(([heading,lines])=>heading==='Analitika ir reklama'&&
 lines.some(line=>line.includes('Google Analytics')&&line.includes('Meta Pixel'))),
 'Actual tracking status and future opt-in requirement must be explicit');
assert.ok(server.includes("SameSite=Lax; Max-Age=")&&server.includes('HttpOnly'),
 'Session cookies must retain appropriate protections');
assert.ok(inventory.includes('NO-GO')&&inventory.includes('OpenStreetMap')&&
 inventory.includes('vietinėje')||inventory.includes('localStorage'));

const firstParty=html+'\n'+app;
for(const tracker of ['googletagmanager.com/gtag/js','connect.facebook.net/en_US/fbevents.js',
 'static.hotjar.com/c/hotjar','clarity.ms/tag/']){
 assert.ok(!firstParty.includes(tracker),'Unexpected nonessential tracking integration: '+tracker);
}
console.log('PASS cookie storage audit: no global Connect load, lazy Stripe, credential cleanup, real privacy disclosure, no known analytics pixels');
