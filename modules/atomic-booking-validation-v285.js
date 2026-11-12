// Database-boundary validation: no fractional or invalid unit holds and no
// malformed date windows, even when an internal caller bypasses HTTP checks.
export function validateAtomicBookingWindow({startDate,endDate,quantity}={}){
  const qty=Number(quantity);
  if(!Number.isInteger(qty)||qty<1||qty>999){
    const error=new Error('Booking quantity must be an integer from 1 to 999');
    error.code='INVALID_BOOKING_QUANTITY';
    throw error;
  }
  const parse=(value,label)=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)){
      const error=new Error(label+' must be a valid YYYY-MM-DD date');
      error.code='INVALID_BOOKING_DATES';throw error;
    }
    const date=new Date(value+'T00:00:00.000Z');
    if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value){
      const error=new Error(label+' is not a calendar date');
      error.code='INVALID_BOOKING_DATES';throw error;
    }
    return date;
  };
  const start=parse(startDate,'startDate');
  const end=parse(endDate,'endDate');
  const days=(end-start)/86400000;
  if(!Number.isInteger(days)||days<1||days>366){
    const error=new Error('Booking must cover 1 to 366 full days');
    error.code='INVALID_BOOKING_DATES';
    throw error;
  }
  return {quantity:qty,startDate,endDate,days};
}
