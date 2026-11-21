// Read-only accounting plan, never an invoice issuance authorization.
export function invoiceIssuerPlan({booking,listing,profile,operatorVatMode='pending_review',foreignServicesVatReviewRequired=true}={}){
 if(!['not_vat_registered','lt_svs','vat_registered','pending_review'].includes(operatorVatMode))throw Error('OPERATOR_VAT_MODE_INVALID');
 if(!booking||!listing||booking.listingId!==(listing.listingId||listing.id))throw Error('TRUSTED_BOOKING_LISTING_REQUIRED');
 const gross=Math.round(Number(booking.orderValue)*100),commission=Math.round(Number(booking.platformFeeAmount)*100);
 if(!Number.isSafeInteger(gross)||gross<=0||!Number.isSafeInteger(commission)||commission<0||commission>gross)throw Error('ACCOUNTING_SNAPSHOT_INVALID');
 const owner=String(listing.ownerEmail||'').toLowerCase();if(!owner)throw Error('SUPPLIER_REQUIRED');
 const verified=profile?.reviewed===1&&String(profile.supplier_email||'').toLowerCase()===owner;
 return {bookingId:booking.bookingId,platform:{issuer:'RentInOrbit operator',recipient:owner,kind:'platform_commission',amountCents:commission,vatMode:operatorVatMode,
  blockers:[...(operatorVatMode==='pending_review'?['OPERATOR_TAX_STATUS_REQUIRED']:[]),...(foreignServicesVatReviewRequired?['FOREIGN_SERVICES_VAT_REVIEW_REQUIRED']:[]),'ACCOUNTING_APPROVAL_REQUIRED'],issuanceAllowed:false},
  rental:{issuer:owner,recipient:booking.customerEmail||null,kind:'supplier_rental_document',grossAmountCents:gross,
   supplierShareCents:gross-commission,profileVerified:verified,vatMode:verified?profile.vat_mode:'unverified',
   privateSupplierCompanyRenter:booking.customerLegalKind==='company'&&!verified,
   blockers:verified?['SUPPLIER_DOCUMENT_OR_VALID_MANDATE_REQUIRED']:['SUPPLIER_TAX_AND_DOCUMENT_STATUS_REQUIRED'],issuanceAllowed:false},
  transactionConfirmationIsTaxInvoice:false,realDocumentNumberAllocated:false};
}
