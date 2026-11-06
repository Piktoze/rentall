// Staging regression guard: audit all static UI markers and booking-confirmation accessibility.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('./index.html','utf8');
const dict=fs.readFileSync('./modules/i18n-v161.js','utf8');
const app=fs.readFileSync('./app.js','utf8');
const journey=fs.readFileSync('./modules/post-booking-journey.js','utf8');
const truth=fs.readFileSync('./modules/post-booking-live-status.js','utf8');
const start=dict.indexOf('const dictionaries={"lt":{');
const end=dict.indexOf('"en":{',start);
assert.ok(start>=0 && end>start,'Lithuanian translation dictionary missing');
const lt=dict.slice(start,end);
const marked=[...html.matchAll(/data-i18n-(?:text|placeholder|aria-label|title)="([^"]+)"/g)]
  .map(m=>m[1].replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'"));
const missing=[...new Set(marked)].filter(key=>!lt.includes(JSON.stringify(key)+':'));
assert.deepEqual(missing,[],'Untranslated Lithuanian UI markers: '+missing.join(', '));
assert.ok(marked.length>500,'Expected complete cross-page static markup coverage');
assert.match(app,/checkoutDialog\.scrollTop=0/,'Booking confirmation must scroll to start');
assert.doesNotMatch(app,/card\.scrollIntoView\(\{behavior:/,'Old hidden-header scroll behavior must not return');
for(const key of ['Booking request received','Pending supplier confirmation','Verified total']){
 assert.ok(app.includes("uiText('"+key+"')"),key+' must use translated UI copy');
}
assert.match(journey,/postBookingTranslate/);
assert.match(truth,/const tr=key=>window\.RentInOrbitI18n/);
console.log('PASS Lithuanian static UI markers: '+marked.length+'; booking success and live statuses localized');
