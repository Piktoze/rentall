import assert from 'node:assert/strict';
import fs from 'node:fs';
import {POLICY_COPY} from './modules/help-center-content-v177.js';
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const privacy=fs.readFileSync('release/PRIVACY_DATA_MAP_LT.md','utf8');
assert.ok(app.includes('function stripBrowserPayoutIdentifiers(accounts)'),
 'Historical browser supplier accounts must be sanitized');
assert.ok(app.includes('delete copy.iban;')&&app.includes('delete copy.taxId;'),
 'Legacy IBAN and tax identifiers must be removed on read and write');
assert.ok(app.includes('existing.some(item=>item&&('),
 'Legacy browser data should be rewritten after sensitive identifiers are purged');
assert.ok(app.includes('JSON.stringify(stripBrowserPayoutIdentifiers(accounts))'),
 'Sensitive identifiers must not be reintroduced by saving supplier accounts');
assert.ok(!app.includes("iban:document.getElementById('accIban').value.trim()"),
 'Browser supplier form must not persist IBAN');
assert.ok(!app.includes("taxId:document.getElementById('accTaxId').value.trim()"),
 'Browser supplier form must not persist tax identifier');
assert.ok(html.includes('id="accIban"')&&html.includes('id="accTaxId"'));
assert.match(html,/id="accIban"[^>]*disabled/);
assert.match(html,/id="accTaxId"[^>]*disabled/);
const sections=POLICY_COPY.lt.privacy.sections;
assert.ok(sections.some(([title,lines])=>title==='Tavo teisės'&&lines.some(s=>s.includes('Valstybinę duomenų apsaugos inspekciją'))),
 'Privacy policy must describe complaint rights and controller identity gap');
assert.ok(sections.some(([title,lines])=>title==='Saugojimas ir saugumas'&&lines.some(s=>s.includes('Konkrečių kategorijų saugojimo terminai'))),
 'Unapproved retention periods must be disclosed as an unresolved prelaunch item, not invented');
assert.ok(privacy.includes('BDAR duomenų tvarkymo inventorius'));
assert.ok(privacy.includes('NO-GO'));
assert.ok(privacy.includes('Stripe Connect'));
console.log('PASS GDPR privacy storage: historical IBAN/tax localStorage purge, no re-save, transparent retention and rights gap');
