import {supplierResponseSchedule} from './modules/supplier-response-clock-v187.js';
function eq(a,b,msg){if(a!==b)throw new Error(`${msg}: ${a} !== ${b}`)}
let x=supplierResponseSchedule('2026-10-27T00:00:00.000Z',4,'Europe/Vilnius');
eq(x.reminder1At,'2026-10-27T06:30:00.000Z','night first reminder');
eq(x.reminder2At,'2026-10-27T08:00:00.000Z','night second reminder');
eq(x.dueAt,'2026-10-27T10:00:00.000Z','night deadline');
x=supplierResponseSchedule('2026-10-27T19:00:00.000Z',4,'Europe/Vilnius');
eq(x.reminder1At,'2026-10-27T19:30:00.000Z','late first reminder');
eq(x.reminder2At,'2026-10-28T07:00:00.000Z','late second reminder');
eq(x.dueAt,'2026-10-28T09:00:00.000Z','late deadline');
x=supplierResponseSchedule('2026-10-27T08:00:00.000Z',4,'Europe/Vilnius');
eq(x.dueAt,'2026-10-27T12:00:00.000Z','day deadline');
console.log('PASS V187 supplier active-hour clock');
