import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8');
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("app.post('/api/rentals/listings/sync', requireRole('supplier','admin')"),'Inventory sync must require supplier/admin auth');
assert(server.includes("keyPrefix:'booking-create'"),'Booking creation rate limit missing');
assert(server.includes("status: 'pending'"),'Client must not control initial booking status');
assert(server.includes("validateAvailabilityWindow(startDate,endDate);"),'Booking date validation missing');
assert(server.includes("const qty=validateRequestedQuantity(quantity);"),'Booking quantity validation missing');
assert(app.includes("if(!user || !['supplier','admin'].includes(user.role)) return;"),'Frontend sync must be supplier-only');
const checkoutBlock=app.slice(app.indexOf("cleanForm.addEventListener('submit'"),app.indexOf("cleanForm.addEventListener('submit'")+5000);
assert(!checkoutBlock.includes('await syncListingsToServer()'),'Guest checkout must not sync local inventory');
console.log('PASS: V44 inventory authorization and booking abuse checks passed.');
