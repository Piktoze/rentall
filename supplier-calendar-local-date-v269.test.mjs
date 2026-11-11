import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app=fs.readFileSync('app.js','utf8');
const initStart=app.indexOf('function initSupplierCalendarDates(){');
const initEnd=app.indexOf('\nfunction populateSupplierCalendarListings()',initStart);
assert.ok(initStart>=0&&initEnd>initStart,'Supplier calendar initializer absent');
const initSource=app.slice(initStart,initEnd);
const originalTz=process.env.TZ;
try{
  // Test a UTC timestamp that is the next local calendar day.
  process.env.TZ='Pacific/Kiritimati';
  const RealDate=Date;
  class FixedDate extends RealDate {
    constructor(...args){super(...(args.length?args:['2026-11-11T11:30:00.000Z']));}
  }
  const nodes={supplierCalendarFrom:{value:''},supplierCalendarTo:{value:''}};
  const context={Date:FixedDate,String,document:{getElementById:id=>nodes[id]||null}};
  vm.runInNewContext(initSource+'\ninitSupplierCalendarDates();',context);
  assert.equal(nodes.supplierCalendarFrom.value,'2026-11-12','Calendar must use local date, not UTC yesterday');
  assert.equal(nodes.supplierCalendarTo.value,'2026-12-10','28-day local interval must be stable');
  // A user-selected start day must survive initialization when only end is empty.
  nodes.supplierCalendarFrom.value='2026-12-01';
  nodes.supplierCalendarTo.value='';
  vm.runInNewContext(initSource+'\ninitSupplierCalendarDates();',context);
  assert.equal(nodes.supplierCalendarFrom.value,'2026-12-01','User-selected start must be preserved');
  assert.equal(nodes.supplierCalendarTo.value,'2026-12-29','Missing end must be derived from selected start');
  assert.ok(app.includes('span>93'),'Calendar must not send ranges forbidden by API');
  assert.ok(app.includes('from<todayKey'),'Calendar must reject past date before network call');
  assert.ok(app.includes('date.toISOString().slice(0,10)===value'),'Calendar must reject invalid dates');
  assert.ok(app.includes('request!==supplierCalendarRequestSequence'),'Stale calendar requests must not overwrite newer selections');
} finally {
  if(originalTz===undefined)delete process.env.TZ;
  else process.env.TZ=originalTz;
}
console.log('PASS calendar local-date rollover, 28-day interval, 93-day limit, invalid date and stale result guards');
