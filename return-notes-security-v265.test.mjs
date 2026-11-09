// Staging-only read-only regression: return notes are untrusted renter/supplier text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('./app.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
const view=app.split('// Add return/refund details into supplier order view by wrapping it.')[1]
  ?.split('// Review modal API.')[0]||'';
assert.ok(view.includes("escapeHtml(String(b.returnNotes||'—'))"),
  'Supplier return notes must be HTML-escaped in innerHTML template');
assert.ok(!view.includes("${b.returnNotes||'—'}"),
  'Supplier return notes must never be interpolated unescaped');
const returnRoute=server.split("app.post('/api/rentals/bookings/:bookingId/return-confirm'")[1]
  ?.split("app.get('/api/rentals/bookings/:bookingId/agreement'")[0]||'';
assert.ok(returnRoute.includes("requireRole('supplier')"),
  'Only supplier may confirm physical return');
assert.ok(returnRoute.includes("canSupplierManageBooking(req.appUser,id)"),
  'Physical return must be scoped to the listing owner');
assert.ok(returnRoute.includes("condition!=='good'&&!notes"),
  'Damaged/missing item must include an explanation');
assert.ok(returnRoute.includes("current.status!=='active'"),
  'Return cannot be repeated or registered before handover');
assert.ok(app.includes('Nuomininko paskyroje sukurtas pranešimas.'),
  'UI must not claim email delivery for a local in-app notification');
console.log('PASS return notes escaped, supplier-only return, condition and status controls, accurate notification');
