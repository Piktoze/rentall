import fs from 'fs';
const h=fs.readFileSync('index.html','utf8'),a=fs.readFileSync('app.js','utf8'),s=fs.readFileSync('server.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(h.includes('Rent what you need. Earn from what you own.'),'core value proposition unclear');
ok(h.includes('id="accDeliveryZones"'),'global delivery zones must be free-form');
ok(!h.includes('€642.00')&&!h.includes('Friday, 23 Oct'),'fabricated payout UI remains');
ok(!/value="Magaluf"|value="Palma Nova"|value="Santa Ponça"/.test(h),'Mallorca-only supplier zones remain');
ok(h.includes('webhook-log-card admin-only')&&h.includes('webhook-simulator admin-only'),'admin diagnostics exposed to suppliers');
ok(a.includes('const paymentHistory = [];'),'fabricated payment history remains');
ok(!a.includes('RENTINORBIT_LEGACY_DEMO_RUNTIME'),'dead legacy runtime remains in core app');
ok(s.includes("service:'rentinorbit'"),'runtime service identity not rebranded');
console.log('PASS: V186 YC launch-focus audit');
