import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=fs.readFileSync('server.js','utf8');
const prefix="app.use('/api',(req,res,next)=>{";
const pos=server.indexOf(prefix);
assert.ok(pos>=0,'Private API response middleware missing');
const body=server.slice(pos,server.indexOf('\n});',pos)+4);
for(const path of ['/auth/','/customer/','/supplier/','/admin/','/payments/','/stripe/','/rentals/','/bookings/','/messages/','/agreements/']){
 assert.ok(body.includes("req.path.startsWith('"+path+"')"),'No-store caching rule missing for '+path);
}
assert.ok(body.includes("res.setHeader('Cache-Control','no-store, private')"),'Private user endpoints must not be cached');
assert.ok(body.includes("res.setHeader('Pragma','no-cache')"),'Compatibility no-cache header missing');
console.log('PASS sensitive rental, booking, auth, agreement, payment and message API cache protections');
