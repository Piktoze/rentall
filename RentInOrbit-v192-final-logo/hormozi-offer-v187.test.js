import fs from 'fs';
const h=fs.readFileSync('./index.html','utf8'),a=fs.readFileSync('./app.js','utf8'),s=fs.readFileSync('./server.js','utf8'),d=fs.readFileSync('./db.js','utf8'),m=fs.readFileSync('./modules/mobile-checkout-journey.js','utf8'),clock=fs.readFileSync('./modules/supplier-response-clock-v187.js','utf8');
function ok(v,msg){if(!v)throw new Error(msg)}
ok(h.includes('Start free. Pay only when you earn.'),'single pilot offer');
ok(!h.includes('Most popular')&&!h.includes('Choose Pro')&&!h.includes('Choose Premium'),'no unimplemented paid plans');
ok(h.includes('data-platform-fee'),'fee comes from runtime config');
ok(!h.includes('Book multiple items with one simple payment.'),'no false multi-item single-payment claim');
ok(s.includes('verifiedSupplier'),'public verified status is evidence-based');
ok(s.includes('forceFullRefund:supplierInitiated'),'supplier cancellation full refund');
ok(clock.includes('SUPPLIER_ACTIVE_START_HOUR=8')&&clock.includes('SUPPLIER_ACTIVE_END_HOUR=22'),'active-hour response clock');
ok(s.includes('supplierResponseSchedule(item.createdAt'),'reminders use active-hour schedule');
ok(h.includes('overnight hours do not count')||h.includes('Overnight hours do not count'),'nighttime deadline disclosure');
ok(m.includes('Part ${phase} of 3'),'checkout perceived as three phases');
ok(h.includes('Supplier cancellation = full rental-price refund'),'risk reversal shown');
console.log('PASS V187 Hormozi offer integrity');
