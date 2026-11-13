// B2B_PRIVATE_RENTAL_GATE_V287
// Until Lithuanian withholding/declaration treatment is reviewed, a corporate renter
// must not transact with a private or unverified supplier through the standard checkout.
export const PRIVATE_TO_COMPANY_REVIEW_CODE='PRIVATE_TO_COMPANY_TAX_REVIEW_REQUIRED';
export function assessCompanyRentalCheckout({customerLegalKind='individual',supplierProfile=null}={}){
  if(customerLegalKind!=='company') return {allowed:true,code:null};
  // Require a VERIFIED business seller, not merely the seller's unchecked declaration.
  if(supplierProfile?.reviewed===1 && ['individual','company'].includes(supplierProfile.legal_kind)){
    return {allowed:true,code:null};
  }
  return {
    allowed:false,
    code:PRIVATE_TO_COMPANY_REVIEW_CODE,
    message:'Įmonei nuomojantis iš privataus arba dar nepatikrinto nuomotojo, prieš apmokėjimą būtina suderinti GPM išskaičiavimo ir apskaitos tvarką. Šiuo metu šio užsakymo tęsti negalima.'
  };
}
