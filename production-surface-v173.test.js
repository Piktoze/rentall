import fs from 'fs';
const h=fs.readFileSync('./index.html','utf8');
const a=fs.readFileSync('./app.js','utf8');
const css=fs.readFileSync('./light-premium-v161.css','utf8');
const i18n=fs.readFileSync('./modules/i18n-v161.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
function parseConst(name,nextName){const re=new RegExp(`const ${name}=(\\{.*?\\});\\n  const ${nextName}=`, 's');const m=i18n.match(re);ok(m,`cannot parse ${name}`);return JSON.parse(m[1]);}
const dict=parseConst('dictionaries','meta');
for(const lang of ['lt','es','de','ru']){
  for(const phrase of [
    '/ month','18% per booking','Seasonal & last-minute pricing','Up to 5 staff accounts','Bulk inventory upload',
    'Clear total price','Secure booking record','Pickup or delivery details before payment',
    'Know what happens before you pay','Your selected dates and quantity are validated before booking.','Rental total and deposit are kept separate.','Confirmation and next actions stay in My Bookings.',
    'Per day','Per week','Hotel / apartment delivery','Zones','Delivery fee','Minimum order','Lead time','Rental estimate','Calculated at checkout','Estimated total','View details','View availability','No rentals found','Reset filters',
    'Using {city} city center','Estimated for {days} day(s) × {qty}'
  ]) ok(dict[lang]?.[phrase],`${lang} missing public phrase: ${phrase}`);
}
ok(!/const defaultListings = \[\s*\{/.test(a),'production must not ship default fake listings');
ok(a.includes('const defaultListings = [];'),'default public inventory must be empty');
ok(a.includes('Server inventory is authoritative even when empty'),'empty server result must clear stale local/demo inventory');
ok(a.includes('purgeLegacyDemoListings'),'legacy demo listings must be purged from old browsers');
ok(!h.includes('<article class="product"'),'static fake product cards must not be public');
ok(css.includes('-webkit-text-fill-color:#143f2f!important'),'plan prices must have explicit dark-green contrast');
ok(css.includes('position:sticky!important'),'primary header must be sticky');
ok(css.includes('scroll-padding-top:88px!important'),'anchor navigation must account for sticky header');
console.log('PASS V173 production surface: language coverage, contrast, sticky header and no fake public inventory');
