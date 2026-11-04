const fs=require('fs');
const assert=require('node:assert/strict');
const vm=require('vm');
const src=fs.readFileSync('modules/i18n-v161.js','utf8');
const context={window:{},document:{readyState:'loading',addEventListener(){}},navigator:{language:'lt'},localStorage:{getItem:()=>null,setItem(){}},console};
vm.runInNewContext(src,context);
const i=context.window.RentInOrbitI18n;
const langs=['lt','en','es','de','ru'];
const sourcePhrases=Object.keys(i.dictionaries.lt).sort();
const keys=Object.keys(i.keyTranslations.en).sort();
for(const lang of langs){
 assert.deepEqual(Object.keys(i.keyTranslations[lang]).sort(),keys,`key parity ${lang}`);
 if(lang!=='en'){
  assert.deepEqual(Object.keys(i.dictionaries[lang]).sort(),sourcePhrases,`phrase parity ${lang}`);
  for(const k of sourcePhrases) assert.ok(i.dictionaries[lang][k]?.trim(),`empty ${lang}:${k}`);
 }
}
for(const phrase of ['Cancel booking','Refund','Refunded','Payment received','Pay securely','View agreement','Report a problem','Platform fee','Supplier share','Pickup / rental start time (supplier local time)']){
 for(const lang of ['lt','es','de','ru'])assert.ok(i.dictionaries[lang][phrase],`missing ${lang}:${phrase}`);
}
const html=fs.readFileSync('index.html','utf8');
const keyed=[...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m=>m[1]);
for(const k of keyed)assert.ok(keys.includes(k),`untranslated html data-i18n: ${k}`);
assert.ok(html.includes('modules/i18n-v161.js?v=203'),'cache-bust locale asset');
const app=fs.readFileSync('app.js','utf8');
const appUiKeys=[...app.matchAll(/\buiText\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
for(const k of appUiKeys)assert.ok(sourcePhrases.includes(k),`untranslated app uiText: ${k}`);
console.log(`PASS: 5 locales, ${keys.length} keyed labels, ${sourcePhrases.length} phrases; HTML/data-i18n/app uiText parity`);
