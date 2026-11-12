// One in-flight cancellation per booking per application process.
// This prevents two overlapping customer/supplier requests from reaching
// Stripe with different refund policies before the booking state is updated.
// Stripe idempotency remains the cross-instance backstop.
export function createBookingCancellationSingleFlight(){
  const active=new Set();
  return async function run(bookingId,operation){
    const id=String(bookingId||'').trim();
    if(!id||typeof operation!=='function')throw new TypeError('Booking and operation required');
    if(active.has(id)){
      const error=new Error('Booking cancellation is already being processed');
      error.code='BOOKING_CANCELLATION_IN_PROGRESS';
      throw error;
    }
    active.add(id);
    try{return await operation();}
    finally{active.delete(id);}
  };
}
