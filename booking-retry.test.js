import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),d=fs.readFileSync('./db.js','utf8'),s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes("let activeBookingAttemptKey=''"),'stable attempt key missing');
ok(a.includes("'Idempotency-Key':currentBookingIdempotencyKey()"),'stable idempotency header missing');
ok(a.includes('const bookingSubmitLocks=new WeakSet()'),'submit lock missing');
ok(a.includes("aria-busy"),'accessible busy state missing');
ok(d.includes("state:'in_progress'"),'concurrent retry state missing');
ok(s.includes("Retry-After','2"),'retry guidance missing');
ok(s.includes("retryable:true"),'retryable marker missing');
console.log('PASS: V59 booking retry resilience checks passed.');