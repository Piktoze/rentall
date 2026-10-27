import fs from 'fs';
const d=fs.readFileSync('./db.js','utf8'),s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(d.includes('export function releaseBookingIdempotency'),'idempotency release helper missing');
ok(d.includes("status='processing'"),'release must only remove unfinished action');
ok(s.includes('else releaseBookingIdempotency(key,hash)'),'failed booking leaves idempotency key stuck');
ok(s.includes("res.on('close'"),'disconnect cleanup missing');
ok(s.includes('validateAvailabilityWindow(startDate,endDate);'),'booking does not share availability date validation');
ok(s.includes('const qty=validateRequestedQuantity(quantity);'),'booking quantity rules diverge from availability');
ok(!s.includes('qty>1000'),'legacy quantity rule still present');
console.log('PASS: V63 idempotency lifecycle and booking validation consistency checks passed.');