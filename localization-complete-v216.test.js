import fs from 'node:fs';
import assert from 'node:assert/strict';
const app=fs.readFileSync('./app.js','utf8');
const html=fs.readFileSync('./index.html','utf8');
const source=fs.readFileSync('./modules/i18n-v161.js','utf8');
function parseObject(marker){
 const begin=source.indexOf(marker)+marker.length;
 assert.ok(begin>=marker.length,'Missing '+marker);
 let level=0,quoted=false,escaped=false;
 for(let i=begin;i<source.length;i++){
  const c=source[i];
  if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}
  if(c==='"')quoted=true;
  else if(c==='{')level++;
  else if(c==='}' && --level===0)return JSON.parse(source.slice(begin,i+1));
 }
 throw new Error('Unclosed locale JSON object');
}
const d=parseObject('const dictionaries='),k=parseObject('const keyTranslations=');
const explicit=[...new Set([...html.matchAll(/data-i18n-(?:text|placeholder|aria-label|title)="([^"]+)"/g)]
 .map(m=>m[1].replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'")))];
const alias=[...new Set([...html.matchAll(/\bdata-i18n="([^"]+)"/g)].map(m=>m[1]))];
const dynamic=[...new Set([...app.matchAll(/uiText\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]))];
const modulePaths=['modules/marketplace-trust-v172.js','modules/supplier-command-v143.js',
  'modules/supplier-finance.js','modules/supplier-operations.js'];
const moduleKeys=[...new Set(modulePaths.flatMap(path=>{
  const src=fs.readFileSync(path,'utf8');
  return [...src.matchAll(/(?:\btr|\buiText|i18n\.t)\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
}))];
for(const lang of ['lt','en','es','de','ru']){
 for(const key of explicit)assert.ok(lang==='en'||typeof d[lang]?.[key]==='string','Missing '+lang+' static: '+key);
 for(const key of alias)assert.ok(typeof k[lang]?.[key]==='string','Missing '+lang+' markup key: '+key);
 for(const key of dynamic)assert.ok(lang==='en'||typeof d[lang]?.[key]==='string'||typeof k[lang]?.[key]==='string',
  'Missing '+lang+' dynamic app text: '+key);
 for(const key of moduleKeys)assert.ok(lang==='en'||typeof d[lang]?.[key]==='string'||typeof k[lang]?.[key]==='string',
  'Missing '+lang+' supplier/marketplace module text: '+key);
}
assert.ok(app.includes('data-i18n-text="Keep your listings live"'),
 'Supplier listing freshness label must retranslate on language change');
console.log('PASS 5-locale coverage: '+explicit.length+' static, '+alias.length+' section, '+dynamic.length+' runtime keys and '+moduleKeys.length+' module keys');
