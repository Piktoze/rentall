import assert from 'node:assert/strict';
import fs from 'node:fs';

// Source regression only. HTTP lifecycle is covered independently by
// rental-http-e2e-v210.test.js on a disposable local database.
const source=fs.readFileSync('./server.js','utf8');
const route=source.split("app.post('/api/rentals/disputes'")[1]
  ?.split('// V100 — provider-confirmed security-deposit')[0]||'';
assert.ok(route,'Dispute API must remain present');
assert.ok(route.includes('const dispute=createRentalDispute('),'Dispute saved before notifications');
const persisted=route.indexOf('const dispute=createRentalDispute(');
const notifications=route.indexOf('for(const recipient of recipients)');
const reply=route.indexOf('res.json({dispute})');
assert.ok(persisted>=0&&notifications>persisted&&reply>notifications,
  'Registration must precede best-effort notices and successful response');
assert.ok(route.includes('for(const recipient of recipients)')&&
  route.includes('try{\n        createRentalNotification(')&&
  route.includes("type:'rental_dispute_notification_failed'"),
  'Each recipient notification failure must be contained independently');
assert.ok(route.includes("audience:recipient.side")&&
  route.includes("uniqueKey:`dispute:${dispute.disputeId}:${recipient.side}`"),
  'Dedupe notifications by dispute and separate participant');
assert.ok(route.includes("title:'Gautas nuomos ginčas'")&&
  route.includes("title:'Ginčas užregistruotas'"),
  'Notifications must be in Lithuanian');
assert.ok(!route.includes('message:`Dispute opened for booking')&&
  !route.includes('message:`A dispute was opened for booking'),
  'Do not restore English dispute notification templates');
assert.ok(!route.includes('${safeReason}.'),'Do not expose free-text dispute reasons in alerts');
assert.ok(route.includes("res.set('Cache-Control','no-store, private')"),
  'Dispute response must be private and not cacheable');
console.log('PASS dispute persisted before isolated localized notifications; no false failure or reason leakage');
