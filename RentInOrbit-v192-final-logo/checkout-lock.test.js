import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes("if(!lockBookingSubmit(cleanForm)) return;"),'live checkout lock missing');
ok(a.includes("unlockBookingSubmit(cleanForm,{completed:true})"),'success identity reset missing');
ok(a.includes("if(!pricing.deliveryRule.eligible){ unlockBookingSubmit(cleanForm); return; }"),'delivery validation lock leak');
ok(a.includes("if(!validateStep(5)){ unlockBookingSubmit(cleanForm); return; }"),'validation lock leak');
ok(a.includes("function bindBookingAttemptIdentity()"),'identity lifecycle binding missing');
console.log('PASS: V60 live checkout lock lifecycle checks passed.');