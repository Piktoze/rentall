import fs from 'fs';

const server=fs.readFileSync('./server.js','utf8');
const app=[fs.readFileSync('./app.js','utf8'),...fs.readdirSync('./modules',{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.js')).map(x=>fs.readFileSync('./modules/'+x.name,'utf8'))].join('\n');

function assert(v,msg){if(!v) throw new Error(msg);}

assert(server.includes("Content-Security-Policy"),'CSP header missing');
assert(server.includes("simpleRateLimit"),'Rate limiting missing');
assert(server.includes("sameOriginWriteGuard"),'Write origin guard missing');
assert(server.includes("Maximum size is 8 MB"),'Upload size check missing');
assert(server.includes("Password must contain at least 8 characters"),'Password minimum missing');
assert(server.includes("app.get('/api/health'"),'Health endpoint missing');
assert(app.includes("function escapeHtml(value)"),'HTML escaping helper missing');
assert(app.includes("Final sanitized listing renderer"),'Sanitized listing renderer missing');

console.log('PASS: V36 security hardening static checks passed.');
