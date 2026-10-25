import fs from 'fs';
const h=fs.readFileSync('./index.html','utf8');
const js=fs.readFileSync('./modules/i18n-v161.js','utf8');
const css=fs.readFileSync('./light-premium-v161.css','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(h.includes('id="sustainability"'),'sustainability section missing');
for(const key of ['sustainability_title','sustainability_intro','sustainability_item1_title','sustainability_item2_title','sustainability_item3_title']) ok(h.includes(`data-i18n="${key}"`),`missing ${key}`);
for(const lang of ['lt','en','es','de','ru']) ok(js.includes(`"${lang}"`),`missing ${lang}`);
ok(css.includes('RentAll V171 — sustainability value'),'sustainability styles missing');
ok(!h.includes('100% eco')&&!h.includes('CO₂ saved'),'unsupported environmental claim present');
console.log('PASS: sustainability value block is localized, factual and styled.');
