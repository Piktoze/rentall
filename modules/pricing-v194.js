export const DEFAULT_PLAN_CODE='STARTER';
export const DEFAULT_CURRENCY='EUR';
export const DEFAULT_COMMISSION_BPS=1500;

export const DEFAULT_STARTER_PLAN=Object.freeze({
  code:DEFAULT_PLAN_CODE,
  name:'Starter',
  monthlyFeeCents:0,
  commissionBps:DEFAULT_COMMISSION_BPS,
  currency:DEFAULT_CURRENCY,
  active:true
});

export function normalizeMoneyCents(value){
  const cents=Number(value);
  if(!Number.isInteger(cents)||cents<0) throw new Error('Money amount must be a non-negative integer number of cents');
  return cents;
}

export function normalizeCommissionBps(value){
  const bps=Number(value);
  if(!Number.isInteger(bps)||bps<0||bps>10000) throw new Error('Commission must be an integer between 0 and 10000 basis points');
  return bps;
}

export function calculateSupplierPricing({bookingAmountCents,plan=DEFAULT_STARTER_PLAN,pricingSource='supplier_plan'}={}){
  const grossCents=normalizeMoneyCents(bookingAmountCents);
  const commissionBps=normalizeCommissionBps(plan?.commissionBps ?? DEFAULT_COMMISSION_BPS);
  const monthlyFeeCents=normalizeMoneyCents(plan?.monthlyFeeCents ?? 0);
  const commissionAmountCents=Math.round((grossCents*commissionBps)/10000);
  const supplierAmountCents=grossCents-commissionAmountCents;
  if(supplierAmountCents<0) throw new Error('Supplier amount cannot be negative');
  return Object.freeze({
    planCode:String(plan?.code||DEFAULT_PLAN_CODE),
    planName:String(plan?.name||'Starter'),
    currency:String(plan?.currency||DEFAULT_CURRENCY).toUpperCase(),
    commissionBps,
    monthlyFeeCents,
    bookingAmountCents:grossCents,
    commissionAmountCents,
    supplierAmountCents,
    pricingSource:String(pricingSource||'supplier_plan')
  });
}

export function pricingSnapshot(pricing){
  if(!pricing) throw new Error('Pricing result is required');
  return Object.freeze({
    version:1,
    planCode:String(pricing.planCode),
    planName:String(pricing.planName),
    currency:String(pricing.currency),
    commissionBps:normalizeCommissionBps(pricing.commissionBps),
    monthlyFeeCents:normalizeMoneyCents(pricing.monthlyFeeCents),
    bookingAmountCents:normalizeMoneyCents(pricing.bookingAmountCents),
    commissionAmountCents:normalizeMoneyCents(pricing.commissionAmountCents),
    supplierAmountCents:normalizeMoneyCents(pricing.supplierAmountCents),
    pricingSource:String(pricing.pricingSource||'supplier_plan')
  });
}

export function proratePricingAfterRefund({snapshot,refundAmountCents}={}){
  const original=pricingSnapshot(snapshot);
  const refundCents=Math.min(normalizeMoneyCents(refundAmountCents),original.bookingAmountCents);
  const netBookingAmountCents=original.bookingAmountCents-refundCents;
  const commissionAmountCents=Math.round((netBookingAmountCents*original.commissionBps)/10000);
  return Object.freeze({
    ...original,
    bookingAmountCents:netBookingAmountCents,
    commissionAmountCents,
    supplierAmountCents:netBookingAmountCents-commissionAmountCents,
    refundAmountCents:refundCents
  });
}
