import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),c=fs.readFileSync('./styles.css','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes('function renderBookingConfirmation(result)'),'confirmation renderer missing');
ok(a.includes('renderBookingConfirmation(result);'),'success path does not render confirmation');
ok(a.includes('Booking request received'),'confirmation state is unclear');
ok(a.includes('Reference <strong>${id}</strong>'),'booking reference missing');
ok(a.includes('Verified total<strong>${money(total)}</strong>'),'trusted total missing');
ok(a.includes("card.setAttribute('aria-live','polite')"),'confirmation accessibility missing');
ok(a.includes("prefers-reduced-motion: reduce"),'confirmation ignores reduced motion');
ok(c.includes('.booking-confirmation-grid'),'confirmation responsive styling missing');
console.log('PASS: V68 booking confirmation UX checks passed.');