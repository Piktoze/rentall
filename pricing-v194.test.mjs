import assert from 'node:assert/strict';
import {DEFAULT_STARTER_PLAN,calculateSupplierPricing,pricingSnapshot,proratePricingAfterRefund} from './modules/pricing-v194.js';

const p100=calculateSupplierPricing({bookingAmountCents:10000});
assert.equal(p100.planCode,'STARTER');
assert.equal(p100.commissionBps,1500);
assert.equal(p100.commissionAmountCents,1500);
assert.equal(p100.supplierAmountCents,8500);
assert.equal(p100.monthlyFeeCents,0);

const p999=calculateSupplierPricing({bookingAmountCents:999});
assert.equal(p999.commissionAmountCents,150);
assert.equal(p999.supplierAmountCents,849);

const futurePro=calculateSupplierPricing({bookingAmountCents:10000,plan:{code:'PRO',name:'Pro',monthlyFeeCents:2900,commissionBps:900,currency:'EUR'}});
assert.equal(futurePro.commissionAmountCents,900);
assert.equal(futurePro.supplierAmountCents,9100);
assert.equal(futurePro.monthlyFeeCents,2900);

const snap=pricingSnapshot(p100);
const refunded=proratePricingAfterRefund({snapshot:snap,refundAmountCents:5000});
assert.equal(refunded.bookingAmountCents,5000);
assert.equal(refunded.commissionAmountCents,750);
assert.equal(refunded.supplierAmountCents,4250);

const fullRefund=proratePricingAfterRefund({snapshot:snap,refundAmountCents:10000});
assert.equal(fullRefund.bookingAmountCents,0);
assert.equal(fullRefund.commissionAmountCents,0);
assert.equal(fullRefund.supplierAmountCents,0);

assert.throws(()=>calculateSupplierPricing({bookingAmountCents:-1}));
assert.throws(()=>calculateSupplierPricing({bookingAmountCents:100,plan:{...DEFAULT_STARTER_PLAN,commissionBps:10001}}));
console.log('pricing-v194 tests passed');
