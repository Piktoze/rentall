import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),c=fs.readFileSync('./styles.css','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes('confirmationMyBookings'),'My bookings confirmation action missing');
ok(a.includes("document.getElementById('myBookingsBtn')?.click()"),'My bookings action not wired');
ok(a.includes("result.paymentToken?'"),'guest secure link action must be conditional');
ok(a.includes('navigator.clipboard.writeText(url)'),'secure link copy missing');
ok(a.includes("encodeURIComponent(token)"),'guest token is not URL encoded');
ok(a.includes("role=\"status\" aria-live=\"polite\""),'copy feedback accessibility missing');
ok(c.includes('.booking-confirmation-actions'),'confirmation action styling missing');
ok(c.includes('min-height:44px'),'mobile touch target missing');
console.log('PASS: V69 booking confirmation action checks passed.');