import fs from 'fs';
const db=fs.readFileSync('./db.js','utf8'),s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function a(v,m){if(!v)throw new Error(m)}
a((Number(p.version.split('.')[0])>=1||Number(p.version.split('.')[1])>=53),'version');a(db.includes('booking_idempotency'),'table');a(db.includes("state:'conflict'"),'conflict');a(db.includes("state:'replay'"),'replay');a(s.includes('bookingRequestHash'),'hash');a(s.includes("req.get('idempotency-key')"),'header');a(s.includes('idempotentReplay:true'),'replay marker');
console.log('PASS: V57 booking idempotency checks passed.');