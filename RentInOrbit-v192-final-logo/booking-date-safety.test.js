import fs from 'fs';
const s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(s.includes("startDate cannot be in the past"),'past-date guard missing');
ok(s.includes("todayUtc.getTime()+730*86400000"),'future horizon missing');
ok(s.includes("startDate is too far in the future"),'future-date guard missing');
ok(s.includes("validateAvailabilityWindow(startDate,endDate);"),'booking does not share date contract');
console.log('PASS: V66 booking date safety checks passed.');