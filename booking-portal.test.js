import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8'),app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("const booking=getRentalBookingById(bookingId)") && server.includes("String(booking.customerEmail||'').toLowerCase()===String(user.email).toLowerCase()"),'Customer session ownership check missing');
assert(server.includes("if(!bookingAccessAllowed(req,bookingId))"),'Reviews must use unified booking access control');
assert(server.includes("Rating must be an integer from 1 to 5"),'Review rating validation missing');
assert(app.includes('async function loadUnifiedCustomerBookings()'),'Unified booking portal missing');
assert(app.includes("loadCustomerBookingsSecure=loadUnifiedCustomerBookings"),'Legacy final loader must be superseded');
assert(app.includes('escapeHtml(t.message)'),'Timeline output must be escaped');
console.log('PASS: V46 unified booking portal/access checks passed.');
