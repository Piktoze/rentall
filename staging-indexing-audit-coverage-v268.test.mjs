import fs from 'node:fs';
import assert from 'node:assert/strict';

const server=fs.readFileSync('server.js','utf8');
const source=fs.readFileSync('ops/audit-surface-v203.mjs','utf8');

const stagingGuard=server.match(/app\.use\(\(req,res,next\)=>\{\s*if\(process\.env\.RENTINORBIT_STAGING==='true'\)\{\s*res\.setHeader\('X-Robots-Tag','noindex, nofollow, noarchive'\)/);
assert.ok(stagingGuard,'Staging HTML and API responses must set noindex/nofollow headers');
assert.ok(!server.includes('STAGING_BOOKING_DIAG_V1'),'Booking request diagnostic must not log personal delivery addresses');

const robots=server.split("app.get('/robots.txt'")[1]?.split("app.get('/sitemap.xml'")[0]||'';
assert.ok(robots.includes("process.env.RENTINORBIT_STAGING==='true'"),'Staging must have separate robots route');
assert.ok(robots.includes('Disallow: /'),'Staging robots.txt must disallow every path');

const sitemap=server.split("app.get('/sitemap.xml'")[1]?.split("function escapeXml")[0]||'';
assert.ok(sitemap.includes("process.env.RENTINORBIT_STAGING==='true'"),'Staging must have separate sitemap route');
assert.ok(sitemap.includes('res.status(404)'),'Staging must not expose test listings to sitemap crawlers');

assert.ok(source.includes('js|cjs|mjs'),'Control audit must include ESM .mjs regression tests');
assert.ok(source.includes('e2e/')&&source.includes('.spec'),'Control audit must include browser E2E specifications');
assert.ok(source.includes('tests/'),'Control audit must include nested tests');

console.log('PASS staging search indexing disabled; static/E2E control coverage inventory includes MJS and browser suites');
