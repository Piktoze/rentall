import fs from 'fs';
const h=fs.readFileSync('./index.html','utf8');
const js=fs.readFileSync('./modules/i18n-v161.js','utf8');
function ok(v,m){if(!v)throw new Error(m)}
for(const lang of ['lt','en','es','de','ru']) ok(h.includes(`value="${lang}"`),`missing ${lang} selector`);
ok(h.includes('modules/i18n-v161.js'),'i18n script not loaded');
ok(h.includes('light-premium-v161.css'),'light theme not loaded');
ok(js.includes("const SUPPORTED=['lt','en','es','de','ru']"),'supported locales');
ok(js.includes("localStorage.getItem('rentall_language')"),'language persistence');
ok(js.includes('document.documentElement.lang=lang'),'html lang update');
ok(js.includes('new MutationObserver'),'dynamic translation observer');
ok(js.includes('translateI18nElements'),'nested data-i18n translation support');

function parseConst(name,nextName){
  const re=new RegExp(`const ${name}=(\\{.*?\\});\\n  const ${nextName}=`, 's');
  const m=js.match(re); ok(m,`cannot parse ${name}`); return JSON.parse(m[1]);
}
const keys=parseConst('keyTranslations','dictionaries');
const dict=parseConst('dictionaries','meta');
const langs=['lt','en','es','de','ru'];
const baseKeySet=Object.keys(keys.en).sort();
for(const lang of langs){
  const got=Object.keys(keys[lang]||{}).sort();
  ok(JSON.stringify(got)===JSON.stringify(baseKeySet),`data-i18n key mismatch for ${lang}`);
}
const basePhraseSet=Object.keys(dict.lt).sort();
for(const lang of ['es','de','ru']){
  const got=Object.keys(dict[lang]||{}).sort();
  const missing=basePhraseSet.filter(k=>!(k in dict[lang]));
  const extra=got.filter(k=>!(k in dict.lt));
  ok(missing.length===0,`${lang} missing ${missing.length} phrase(s): ${missing.slice(0,8).join(', ')}`);
  ok(extra.length===0,`${lang} has ${extra.length} unmatched phrase(s): ${extra.slice(0,8).join(', ')}`);
  ok(got.length===basePhraseSet.length,`${lang} phrase count ${got.length} != ${basePhraseSet.length}`);
}
ok(basePhraseSet.length>=348,`expected at least 348 UI phrases, got ${basePhraseSet.length}`);
for(const phrase of ['10 Folding Chairs','Lithuania','Browse local rentals','Supplier command center','Admin dashboard','Your rental request is in.']){
  ok(phrase in dict.lt,`LT missing critical phrase ${phrase}`);
  for(const lang of ['es','de','ru']) ok(phrase in dict[lang],`${lang} missing critical phrase ${phrase}`);
}
console.log(`PASS: complete i18n parity — ${baseKeySet.length} keyed strings and ${basePhraseSet.length} UI phrases aligned across LT/ES/DE/RU; EN is source locale.`);
