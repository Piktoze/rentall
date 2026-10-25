import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('./light-premium-v161.css',import.meta.url),'utf8');
const i18n=fs.readFileSync(new URL('./modules/i18n-v161.js',import.meta.url),'utf8');

const partnerSelect=html.match(/<select id="partnerCategory"[\s\S]*?<\/select>/)?.[0]||'';
const optionCount=(partnerSelect.match(/<option /g)||[]).length-1; // excluding placeholder
assert.ok(optionCount>=20,`expected >=20 supplier categories, got ${optionCount}`);
assert.ok(html.includes('Continue supplier registration'));
assert.ok(app.includes("openAuth('register')"));
assert.ok(app.includes("role.value='supplier'"));
assert.ok(app.includes("regEmail.value=email"));
assert.ok(app.includes("regPhone.value=phone"));
assert.ok(app.includes("const role=document.getElementById('regRole')?.value==='supplier'?'supplier':'customer'"));
assert.ok(app.includes("Account created — you are now signed in."));
assert.ok(css.includes('.topbar .brand::before'));
assert.ok(css.includes('width:44px!important'));
assert.ok(css.includes('font-size:29px!important'));

for(const phrase of ['Construction equipment','Cleaning equipment','Computers & IT','Audio & music equipment','Travel equipment','Medical & mobility equipment','Games & entertainment','Continue supplier registration','Business name']){
  const count=(i18n.match(new RegExp('"'+phrase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"','g'))||[]).length;
  assert.equal(count,4,`${phrase} must exist in LT/ES/DE/RU dictionaries; got ${count}`);
}
console.log(`supplier-entry-v174 PASS (${optionCount} categories)`);
