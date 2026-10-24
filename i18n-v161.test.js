
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
ok(js.includes("new MutationObserver"),'dynamic translation observer');
console.log('PASS: V161 i18n and light design checks passed.');
