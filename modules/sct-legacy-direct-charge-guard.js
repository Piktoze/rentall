// Fail closed if a legacy Direct Charges path is asked to operate on a booking
// with an SCT TEST binding. Until full SCT refunds, deposit and expiry handling
// exist, do not create connected-account charges or refunds for those bookings.
export function assessLegacyDirectChargeOperation(db,bookingId){
  if(typeof bookingId!=='string'||!/^RB-[A-Za-z0-9-]+$/.test(bookingId))
    return {blocked:'invalid_booking_id'};
  if(!db?.prepare)return {blocked:'database_required'};
  const hasTable=db.prepare(`SELECT 1 FROM sqlite_master
    WHERE type='table' AND name='sct_booking_bindings'`).get();
  if(!hasTable)return {ok:true};
  const row=db.prepare(`SELECT booking_id FROM sct_booking_bindings
    WHERE booking_id=? LIMIT 1`).get(bookingId);
  if(row)return {blocked:'SCT_REQUIRES_SEPARATE_FINANCIAL_FLOW'};
  return {ok:true};
}
