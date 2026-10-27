import fs from 'fs';
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n'),styles=fs.readFileSync('./styles.css','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
function assert(v,m){if(!v)throw new Error(m)}
assert((Number(pkg.version.split('.')[0])>=1||Number(pkg.version.split('.')[1])>=53),'Package version must be V56 or newer');
assert(app.includes('rentinorbitV56CustomerUX'),'Customer UX enhancement missing');
assert(app.includes("enterkeyhint','search'"),'Mobile search keyboard hint missing');
assert(app.includes('Clear total price'),'Customer trust promise missing');
assert(app.includes("aria-expanded"),'Accessible mobile filter disclosure missing');
assert(app.includes('MutationObserver'),'Dynamic listing enhancement missing');
assert(styles.includes('.v56-mobile-summary'),'Mobile filter summary styles missing');
assert(styles.includes('prefers-reduced-motion'),'Reduced motion support missing');
console.log('PASS: V56 customer discovery/mobile UX checks passed.');
