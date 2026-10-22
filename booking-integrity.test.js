import fs from 'fs';
const s=fs.readFileSync('./server.js','utf8'),a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(s.includes("keyPrefix:'booking-create'}), bookingIdempotency, (req, res) =>"),'idempotency middleware is not attached to real booking route');
ok(s.includes("customerPhone,\n      accommodationName,"),'customer phone/accommodation mapping regression remains');
ok(!s.includes("customerPhone:\n      accommodationName"),'broken customerPhone mapping remains');
ok(a.includes('function currentBookingIdempotencyKey'),'stable client idempotency key generator missing');
ok(a.includes("'Idempotency-Key':currentBookingIdempotencyKey()"),'client idempotency header missing');
ok(a.includes('createBookingWithSafeRetry({') && a.includes("'Idempotency-Key':currentBookingIdempotencyKey()"),'authoritative customer booking path does not preserve idempotency');
console.log('PASS: V58 booking route integrity and duplicate-submit protection checks passed.');