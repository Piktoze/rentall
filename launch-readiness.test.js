import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
function assert(v,m){if(!v)throw new Error(m)}
assert((Number(pkg.version.split('.')[0])>=1||Number(pkg.version.split('.')[1])>=53),'Package version must be V53 or newer');
assert(!server.includes("keyPrefix:'register'}), simpleRateLimit"),'Duplicate register limiter remains');
assert(!server.includes("keyPrefix:'login'}), simpleRateLimit"),'Duplicate login limiter remains');
assert(server.includes("version:APP_VERSION"),'Health version must not be stale');
assert(!server.includes("version:'0.36.0'"),'Stale health version remains');
assert(server.includes("app.get('/api/admin/diagnostics', requireRole('admin')"),'Detailed diagnostics must be admin-only');
assert(server.includes("app.get('/robots.txt'"),'robots.txt route missing');
assert(server.includes("app.get('/sitemap.xml'"),'sitemap.xml route missing');
assert(server.includes("process.env.PUBLIC_BASE_URL"),'Canonical public origin config missing');
assert(server.includes("process.env.TRUST_PROXY_HOPS"),'Explicit proxy trust config missing');
console.log('PASS: V53 launch-readiness, health privacy and duplicate-middleware checks passed.');
