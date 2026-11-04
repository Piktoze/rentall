// RentInOrbit V197 — immutable booking cancellation terms and explicit start instant.
// Times must be supplied in the supplier listing's IANA timezone.
export const MODERATE_POLICY_VERSION='moderate-2026-11-03-v1';
export const POLICY_VERSIONS=Object.freeze({moderate:MODERATE_POLICY_VERSION,flexible:'flexible-v1',strict:'strict-v1'});
export function policyVersion(policy){return POLICY_VERSIONS[String(policy||'moderate')]||MODERATE_POLICY_VERSION;}
export function validIanaTimeZone(timeZone){
  try{new Intl.DateTimeFormat('en-US',{timeZone:String(timeZone)});return true}catch{return false}
}
function partsInZone(date,timeZone){
  const fields={};
  for(const p of new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date)){
    if(p.type!=='literal')fields[p.type]=Number(p.value);
  }
  return fields;
}
export function resolveRentalStart({startDate,startTime,timeZone}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate||'')))throw new Error('Valid startDate is required');
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(startTime||'')))throw new Error('Valid startTime (HH:mm) is required');
  if(!validIanaTimeZone(timeZone))throw new Error('Valid rental time zone is required');
  const [year,month,day]=startDate.split('-').map(Number);
  const [hour,minute]=startTime.split(':').map(Number);
  const target=Date.UTC(year,month-1,day,hour,minute);
  if(new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==startDate)throw new Error('Invalid calendar date');
  // Resolve the civil time against zone offsets; reject DST gaps and overlaps.
  const matches=[];
  for(let shift=-14*60;shift<=14*60;shift+=15){
    const ms=target+shift*60000;
    const v=partsInZone(new Date(ms),timeZone);
    if(v.year===year&&v.month===month&&v.day===day&&v.hour===hour&&v.minute===minute)matches.push(ms);
  }
  if(matches.length!==1)throw new Error('Ambiguous or nonexistent rental start time. Choose a different time.');
  return new Date(matches[0]).toISOString();
}
export function fractionForCancellation(policy,version,hours){
  if(!Number.isFinite(hours))throw new Error('Invalid rental start instant');
  if(policy==='flexible')return hours>=24?1:hours>0?0.5:0;
  if(policy==='strict')return hours>=168?0.5:0;
  if(version===MODERATE_POLICY_VERSION)return hours>=48?1:hours>=24?.75:hours>=12?.5:0;
  // Legacy moderate policy was full >=72h, 50% >=24h.
  return hours>=72?1:hours>=24?.5:0;
}
export function refundFromBooking(booking,policy,now=new Date()){
  const value=Math.max(0,Number(booking?.orderValue||0));
  if(!value)return 0;
  const start=booking?.rentalStartAt ? new Date(booking.rentalStartAt):new Date(String(booking?.startDate||'')+'T00:00:00Z');
  if(!Number.isFinite(start.getTime()))throw new Error('Invalid rental start date');
  const version=booking?.cancellationPolicyVersion || (policy==='moderate'?'moderate-legacy-v1':policyVersion(policy));
  return Math.round(value*fractionForCancellation(policy,version,(start-new Date(now))/3600000)*100)/100;
}
