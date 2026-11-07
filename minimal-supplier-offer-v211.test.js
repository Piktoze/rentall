import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');
const dictionaries=fs.readFileSync('modules/i18n-v161.js','utf8');
const start=html.indexOf('<section class="section editorial-accent-section" id="pricing">');
const end=html.indexOf('</section>',start);
assert.ok(start>=0&&end>start,'Supplier offer section missing');
const pricing=html.slice(start,end);
assert.ok(pricing.includes('data-platform-fee'),'Visible commission must be transparent');
assert.ok(pricing.includes('plan-price'),'Visible monthly charge must be transparent');
assert.ok(pricing.includes('href="#list-item" id="supplierOfferStartBtn"'),'Supplier offer must link to accessible listing action');
assert.equal((pricing.match(/id="supplierOfferStartBtn"/g)||[]).length,1,'One supplier CTA in offer');
assert.ok(html.includes('class="hero-supplier-cta listing-section" id="list-item"'),'Listing action must be in top hero');
assert.equal((html.match(/id="openListingFormBtn"/g)||[]).length,1,'Single working listing form trigger');
for(const key of ['supplier_offer_copy','supplier_offer_b1','supplier_offer_note','supplier_offer_label'])
 assert.ok(!pricing.includes('data-i18n="'+key+'"'),'Repeated or speculative offer messaging: '+key);
assert.ok(!pricing.includes('Paid plans'),'Future plans should not be advertised');
const partner=html.slice(html.indexOf('id="partnerForm"'),html.indexOf('</section>',html.indexOf('id="partnerForm"')));
assert.ok(!partner.includes('list it and let it earn'),'Supplier message should not be repeated in contact form');
for(const text of ['"supplier_offer_title":"Išnuomok tai, ką turi"','"supplier_offer_title":"Rent out what you own"'])
 assert.ok(dictionaries.includes(text),'Updated heading translation absent');
console.log('PASS minimal supplier offer, honest pricing, no future plans or duplicate messaging');
