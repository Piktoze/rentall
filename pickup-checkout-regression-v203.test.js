import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('./app.js','utf8');
const html=fs.readFileSync('./index.html','utf8');
const start=app.indexOf('function wireAuthoritativeCheckout()');
const end=app.indexOf('\n\n// V33 final boot.',start);
const handler=app.slice(start,end<0?undefined:end);
assert.ok(start>=0,'authoritative checkout handler missing');
assert.match(handler,/pickupOnly\s*=\s*\/pickup\|atsiim\|atsiėm\/i/);
assert.match(handler,/accommodationName:pickupOnly\?null:delivery\.accommodationName/);
assert.match(handler,/deliveryAddress:pickupOnly\?null:delivery\.address/);
assert.match(handler,/checkoutSubmitError/);
assert.match(html,/id="checkoutSubmitError"[^>]*role="alert"/);
for(const method of ['Pickup from owner','Atsiimti iš nuomotojo']){
  assert.match(method,/pickup|atsiim|atsiėm/i);
}
console.log('PASS: pickup booking omits delivery-only fields and shows server rejection in checkout');
