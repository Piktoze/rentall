// Commercial choice A, approved 2026-11-18. Applies to new SCT bookings only.
export const PLATFORM_COST_POLICY=Object.freeze({
 version:'platform-costs-2026-11-18',commissionBps:1500,
 paymentProcessing:'platform',connect:'platform',bankPayout:'platform',
 deductProviderCostsFromSupplier:false
});
export function assertPlatformCostConfiguration(env){
 if(env.SCT_STRIPE_FEE_PAYER!=='platform')throw Object.assign(new Error('SCT_PLATFORM_COST_POLICY_REQUIRED'),{code:'SCT_PLATFORM_COST_POLICY_REQUIRED'});
 if(env.PLATFORM_FEE_PERCENT!==undefined&&Number(env.PLATFORM_FEE_PERCENT)!==15)
  throw Object.assign(new Error('SCT_COMMISSION_MUST_BE_15_PERCENT'),{code:'SCT_COMMISSION_MUST_BE_15_PERCENT'});
}
export function calculatePlatformCostSplit(grossCents){
 if(!Number.isSafeInteger(grossCents)||grossCents<0)throw new TypeError('Integer cents required');
 const platformCommissionCents=Math.round(grossCents*PLATFORM_COST_POLICY.commissionBps/10000);
 return Object.freeze({grossCents,platformCommissionCents,supplierCents:grossCents-platformCommissionCents,costPolicyVersion:PLATFORM_COST_POLICY.version});
}
