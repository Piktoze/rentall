import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8'),app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("app.get('/api/customer/bookings', requireRole"),'Authenticated account booking endpoint missing');
assert(server.includes("const effectiveCustomerEmail=authenticatedUser?.email || customerEmail || null"),'Signed-in booking identity must bind to session');
assert(app.includes("const data=await apiJson('/api/customer/bookings')"),'My Bookings must use authenticated endpoint');
assert(!app.includes("apiJson(`/api/customer/bookings?customerEmail=${encodeURIComponent(email)}`)"),'Email-only booking history lookup must not remain');
assert(app.includes('Guest history is intentionally not exposed by email alone'),'Guest privacy fallback missing');
console.log('PASS: V45 booking-history privacy/account checks passed.');
