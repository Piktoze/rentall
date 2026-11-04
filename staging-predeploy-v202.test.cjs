const fs=require('node:fs');const assert=require('node:assert/strict');
const s=fs.readFileSync('server.js','utf8');const cfg=fs.readFileSync('.railway/railway.ts','utf8');
assert.match(s,/import crypto from 'crypto'/);
assert.match(s,/const payoutVerified=directMerchantReady\(payoutConnection\)/);
assert.match(s,/const verifiedSupplier=directMerchantReady\(payoutConnection\)/);
assert.doesNotMatch(cfg,/preDeployCommand/);
assert.doesNotMatch(cfg,/(?:build|start):[^\n]*STAGING_PATCH/);
console.log('PASS v202 staging predeploy guards');
