// V292: read-only delegated rental-invoice preflight. Never issues, numbers or sends documents.
// All data must originate from the trusted database, not a request's self-declared metadata.
export function assessRentalInvoicePreflight({booking,listing,profile,mandate,terms}={}){
 const blocks=[];
 const add=(code,ok)=>{if(!ok)blocks.push(code)};
 add('BOOKING_MISSING',!!booking);
 add('LISTING_OWNERSHIP_UNVERIFIED',!!booking&&!!listing&&
   String(booking.listingId||'')===String(listing.listingId||listing.id||''));
 const owner=String(listing?.ownerEmail||'').trim().toLowerCase();
 add('SUPPLIER_EMAIL_MISSING',!!owner);
 add('SUPPLIER_PROFILE_UNVERIFIED',!!profile&&profile.reviewed===1 &&
   ['company','individual'].includes(profile.legal_kind) &&
   String(profile.supplier_email||'').trim().toLowerCase()===owner);
 add('SUPPLIER_LEGAL_DETAILS_INCOMPLETE',!!profile?.legal_name?.trim()&&
   !!profile?.business_address?.trim()&&!!profile?.registration_number?.trim());
 add('SUPPLIER_TAX_MODE_UNVERIFIED',!!profile&&
   ['not_vat_registered','lt_svs','vat_registered'].includes(profile.vat_mode));
 add('SUPPLIER_INVOICE_OPT_IN_MISSING',profile?.can_issue_on_behalf===1);
 add('MANDATE_NOT_APPROVED',!!mandate&&mandate.status==='approved'&&
   String(mandate.supplier_email||'').trim().toLowerCase()===owner&&!!mandate.approved_by);
 add('MANDATE_TERMS_OUTDATED',!!mandate&&!!terms&&
   mandate.version===terms.version&&mandate.terms_digest===terms.termsDigest);
 const payment=String(booking?.paymentStatus||'').toLowerCase();
 add('RENTAL_NOT_PAID',!!booking&&payment==='paid'&&!!booking.stripePaymentIntentId);
 add('RENTAL_REFUNDED_OR_DISPUTED',!!booking&&
   !['cancelled','canceled','declined','expired'].includes(String(booking.status||'').toLowerCase())&&
   !['refunded','partially_refunded','refund_pending','refund_processing','disputed','chargeback','chargeback_pending'].includes(payment)&&
   !['disputed','chargeback','refund_pending','refund_processing'].includes(String(booking.status||'').toLowerCase())&&
   !booking.stripeRefundId&&Number(booking.refundAmount||0)===0);
 const amount=Math.round(Number(booking?.orderValue)*100);
 add('RENTAL_AMOUNT_INVALID',!!booking&&Number.isSafeInteger(amount)&&amount>0);
 add('RENTER_IDENTITY_INCOMPLETE',!!booking&&
   (booking.customerLegalKind==='company'?!!String(booking.customerCompanyName||'').trim():
     !!String(booking.customerName||'').trim())&&
   !!String(booking.customerEmail||'').trim());
 // This is deliberately an independent legal/accounting go-live hold.
 blocks.push('LIVE_ACCOUNTING_LEGAL_SIGNOFF_REQUIRED');
 return {
   bookingId:booking?.bookingId||null,
   supplierEmail:owner||null,
   documentKind:'supplier_rental_invoice',
   technicalPreflightPassed:blocks.length===1&&blocks[0]==='LIVE_ACCOUNTING_LEGAL_SIGNOFF_REQUIRED',
   realInvoiceIssuanceAllowed:false,
   realEmailDeliveryAllowed:false,
   invoiceNumberAllocated:false,
   blockers:blocks
 };
}
