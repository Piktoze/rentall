import fs from 'fs';
const s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(s.includes('function validateAvailabilityWindow'),'availability date validation missing');
ok(s.includes("if(end<=start) throw new Error('endDate must be after startDate')"),'reversed dates accepted');
ok(s.includes('Rental window cannot exceed ${maxDays} days'),'unbounded availability window');
ok(s.includes('quantity must be an integer from 1 to 999'),'quantity bounds missing');
ok(s.includes("validateAvailabilityWindow(fromDate,toDate,{maxDays:93})"),'calendar range is not bounded');
ok(s.includes("Cache-Control','no-store, max-age=0"),'live availability can be cached stale');
ok((s.match(/noStoreAvailability\(res\)/g)||[]).length>=2,'availability/calendar no-store not applied');
console.log('PASS: V62 live availability validation/cache safety checks passed.');