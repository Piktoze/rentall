const fs=require('fs');
const assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const version='203';
for(const asset of ['styles.css','light-premium-v161.css','app.js','modules/i18n-v161.js']) {
  assert(html.includes(asset+'?v='+version), 'HTML stale asset: '+asset);
  assert(sw.includes('/'+asset+'?v='+version),'service worker stale asset: '+asset);
}
assert(sw.includes("rentinorbit-v203-shell"));
assert(app.includes("serviceWorker.register('/service-worker.js?v=203')"));
assert(sw.includes("url.pathname.startsWith('/api/')"),'API cache exclusion missing');
assert(sw.includes("url.pathname.startsWith('/uploads/')"),'uploads cache exclusion missing');
console.log('PASS: v203 HTML, JS, SW asset cache versions match');
