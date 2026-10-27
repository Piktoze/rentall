import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes('err.status=res.status'),'api error status metadata missing');
ok(a.includes('err.retryable=!!data.retryable'),'retryable metadata missing');
ok(a.includes("res.headers.get('Retry-After')"),'Retry-After support missing');
ok(a.includes('async function createBookingWithSafeRetry(payload)'),'safe booking retry helper missing');
ok(a.includes('if(err.status===409 && err.retryable)'),'retry is not restricted to explicit in-progress response');
ok(a.includes("return apiJson('/api/rentals/bookings',options)"),'retry does not reuse original request options/idempotency key');
ok(a.includes('const result=await createBookingWithSafeRetry({'),'authoritative checkout does not use safe retry');
console.log('PASS: V61 safe idempotent booking retry checks passed.');