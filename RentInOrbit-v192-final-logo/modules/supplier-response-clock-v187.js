// V187 supplier response clock: count only 08:00–22:00 in the supplier's local timezone.
export const SUPPLIER_ACTIVE_START_HOUR=8;
export const SUPPLIER_ACTIVE_END_HOUR=22;
export const COUNTRY_TIMEZONE_DEFAULTS={LT:'Europe/Vilnius',ES:'Europe/Madrid',PT:'Europe/Lisbon',GR:'Europe/Athens',CY:'Asia/Nicosia',IT:'Europe/Rome',FR:'Europe/Paris',DE:'Europe/Berlin'};
export function validTimezone(value){
  const tz=String(value||'').trim(); if(!tz)return null;
  try{new Intl.DateTimeFormat('en',{timeZone:tz}).format(new Date());return tz}catch{return null}
}
export function supplierTimezoneForListing(listing){return validTimezone(listing?.supplierTimezone)||COUNTRY_TIMEZONE_DEFAULTS[String(listing?.country||'').toUpperCase()]||'UTC'}
function zonedParts(date,timeZone){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const bag={}; for(const p of parts)if(p.type!=='literal')bag[p.type]=Number(p.value);
  return {year:bag.year,month:bag.month,day:bag.day,hour:bag.hour,minute:bag.minute,second:bag.second||0};
}
function zonedLocalToUtc(parts,timeZone){
  const target=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour||0,parts.minute||0,parts.second||0);
  let guess=target;
  for(let i=0;i<3;i++){
    const actual=zonedParts(new Date(guess),timeZone);
    const actualEpoch=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second);
    const delta=target-actualEpoch; if(Math.abs(delta)<1000)break; guess+=delta;
  }
  return new Date(guess);
}
function nextLocalDay(parts){const d=new Date(Date.UTC(parts.year,parts.month-1,parts.day+1));return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}}
export function addSupplierActiveMinutes(from,minutes,timeZone){
  const tz=validTimezone(timeZone)||'UTC'; let cursor=new Date(from); let remaining=Math.max(0,Number(minutes||0));
  for(let guard=0;guard<20 && remaining>0;guard++){
    let lp=zonedParts(cursor,tz);
    if(lp.hour<SUPPLIER_ACTIVE_START_HOUR){cursor=zonedLocalToUtc({...lp,hour:SUPPLIER_ACTIVE_START_HOUR,minute:0,second:0},tz);lp=zonedParts(cursor,tz)}
    else if(lp.hour>=SUPPLIER_ACTIVE_END_HOUR){const n=nextLocalDay(lp);cursor=zonedLocalToUtc({...n,hour:SUPPLIER_ACTIVE_START_HOUR,minute:0,second:0},tz);lp=zonedParts(cursor,tz)}
    const end=zonedLocalToUtc({...lp,hour:SUPPLIER_ACTIVE_END_HOUR,minute:0,second:0},tz);
    const available=Math.max(0,Math.round((end-cursor)/60000));
    if(remaining<=available)return new Date(cursor.getTime()+remaining*60000);
    remaining-=available; const n=nextLocalDay(lp);cursor=zonedLocalToUtc({...n,hour:SUPPLIER_ACTIVE_START_HOUR,minute:0,second:0},tz);
  }
  return cursor;
}
export function supplierResponseSchedule(createdAt,hours=4,timeZone='UTC'){
  const created=new Date(createdAt); const activeMinutes=Math.max(60,Math.min(48,Number(hours||4))*60);
  const tz=validTimezone(timeZone)||'UTC';
  return {timeZone:tz,reminder1At:addSupplierActiveMinutes(created,Math.min(30,activeMinutes),tz).toISOString(),reminder2At:addSupplierActiveMinutes(created,Math.min(120,activeMinutes),tz).toISOString(),dueAt:addSupplierActiveMinutes(created,activeMinutes,tz).toISOString()};
}
