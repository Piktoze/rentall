import fs from 'fs';
const s=fs.readFileSync('./server.js','utf8'),a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(s.includes('calculateAuthoritativeBookingTotal'),'server pricing missing');
ok(s.includes('orderValue:authoritativePrice.total'),'client orderValue still trusted');
ok(s.includes('price:authoritativePrice'),'trusted breakdown missing');
ok(s.includes("userEmail:effectiveCustomerEmail"),'notification identity not authoritative');
ok(a.includes('Math.min(dailyTotal,weekMix)*qty'),'client duration/quantity estimate missing');
console.log('PASS: V64 price/payment integrity checks passed.');