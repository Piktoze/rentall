// Declared operator status is separate from accounting sign-off and foreign VAT duties.
export function operatorTaxProfile(env=process.env){
 const declared=String(env.LEGAL_OPERATOR_VAT_MODE||'');
 const vatMode=['not_vat_registered','lt_svs','vat_registered'].includes(declared)?declared:'pending_review';
 const code=String(env.LEGAL_ACTIVITY_CODE||'').replaceAll('.','');
 return Object.freeze({vatMode,activityCode:/^\d{6}$/.test(code)?code:null,
  classification:env.LEGAL_ACTIVITY_CLASSIFICATION==='EVRK_2_1'?'EVRK 2.1':null,
  foreignServicesVatReviewRequired:env.LEGAL_FOREIGN_SERVICE_VAT_REVIEWED!=='true',
  registrationChanged:false,accountingIssuanceAllowed:false});
}
