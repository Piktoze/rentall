import fs from 'fs';
const a=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),c=fs.readFileSync('./styles.css','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(a.includes('function renderCheckoutPriceBreakdown'),'breakdown renderer missing');
ok(a.includes('Rental · ${days}'),'duration not shown');
ok(a.includes("${qty===1?'item':'items'}"),'quantity not shown');
ok(a.includes("box.setAttribute('aria-live','polite')"),'accessible live announcement missing');
ok(a.includes('Final price is verified securely before the booking is created.'),'price authority cue missing');
ok(a.includes('renderCheckoutPriceBreakdown({rental,delivery,total,securityDeposit});'),'breakdown not wired to live total');
ok(c.includes('.checkout-price-breakdown'),'breakdown styling missing');
console.log('PASS: V67 checkout price transparency checks passed.');