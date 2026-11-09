import assert from 'node:assert/strict';
import fs from 'node:fs';

// Read-only release gate. Real HTTP double-submit test is in rental-http-e2e-v210.
const db=fs.readFileSync('./db.js','utf8');
const fragment=db.split('const createRentalDisputeAtomic=')[1]
  ?.split('export function listRentalDisputes()')[0]||'';
assert.ok(fragment.includes('db.transaction('),
  'Open-dispute uniqueness must be checked inside a SQLite transaction');
assert.ok(fragment.includes('createRentalDisputeAtomic.immediate('),
  'BEGIN IMMEDIATE must reserve the writer before the uniqueness read');
assert.ok(fragment.includes('findOpenDisputeStmt.get(bookingId)'),
  'Check current open disputes in same immediate transaction');
assert.ok(fragment.indexOf('findOpenDisputeStmt.get(bookingId)') <
  fragment.indexOf('createDisputeStmt.run('),
  'Uniqueness read must precede write in the locked transaction');
assert.ok(fragment.includes("err.code='DISPUTE_ALREADY_OPEN'"),
  'Concurrent duplicate dispute returns a stable conflict code');
assert.ok(!fragment.includes('listDisputesStmt.all().find('),
  'Do not reintroduce full-table duplicate checks outside the write transaction');
console.log('PASS dispute creation uses serialized immediate transaction and scoped uniqueness lookup');
