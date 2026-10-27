import fs from 'fs';
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');
const server=fs.readFileSync('./server.js','utf8');
function assert(v,m){if(!v)throw new Error(m)}

assert(app.includes('let currentServerUser=null;'),'currentServerUser declaration missing');
assert(app.includes('currentServerUser=serverUser;'),'currentServerUser synchronization missing');
assert(app.includes('currentServerUser=null;'),'currentServerUser logout reset missing');

assert(!server.includes('getSessionUser(req)'),'Undefined getSessionUser runtime call remains');
assert(server.includes('const sessionUserForValidation=sessionUser(req);'),'Booking validation must use sessionUser');
assert(server.includes('const sessionUser=sessionUser(req);')===false,'Do not shadow sessionUser function with same local identifier');
assert(server.includes('const effectiveCustomerEmail='),'Session-bound booking identity missing');

assert(app.includes('aria-pressed="${favorite?'),'Favorite accessibility state missing');
assert(app.includes("btn.setAttribute('aria-pressed',active?'true':'false')"),'Favorite accessibility state update missing');

console.log('PASS: V49 critical runtime-symbol and favorite accessibility checks passed.');
