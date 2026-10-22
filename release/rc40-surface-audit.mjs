import fs from'node:fs';
const read=p=>fs.readFileSync(p,'utf8'), must=(v,m)=>{if(!v)throw new Error(m)};
const h=read('index.html'),s=read('server.js'),css=read('styles.css');
const modules=fs.readdirSync('modules').filter(x=>x.endsWith('.js')).map(x=>read('modules/'+x)).join('\n');
const checks={
 customer:[
  ['discovery',/search|discover/i.test(h+modules)],
  ['listing',/listing/i.test(h+modules)],
  ['availability',/availability/i.test(h+modules)],
  ['checkout',/checkout/i.test(h+modules)],
  ['payment',/payment/i.test(h+modules)],
  ['confirmation',/confirmation|confirmed/i.test(h+modules)],
  ['my_bookings',/My Bookings|customerBookingsList/i.test(h)]
 ],
 supplier:[
  ['inventory',/inventory/i.test(h+modules)],
  ['calendar',/calendar/i.test(h+modules)],
  ['pricing',/pricing/i.test(h+modules)],
  ['bookings',/booking/i.test(h+modules)],
  ['earnings',/Earnings/i.test(h)],
  ['payouts',/Payouts/i.test(h)]
 ],
 security:[
  ['stripe_signature',s.includes('stripe.webhooks.constructEvent')],
  ['supplier_transfer_gate',s.includes('requireSupplierTransferCapability')],
  ['guest_token',s.includes('verifyBookingPaymentToken')],
  ['deposit_provider_authority',s.includes('amount_capturable_updated')],
  ['email_worker_opt_in',s.includes("EMAIL_WORKER_ENABLED==='true'")]
 ],
 release:[
  ['health',s.includes("'/healthz'")||s.includes('"/healthz"')],
  ['readiness',s.includes("'/api/readiness'")],
  ['ops_status',s.includes("'/api/ops/status'")],
  ['mobile_css',/@media\(max-width:/.test(css)]
 ]
};
const failed=[];
for(const [group,items] of Object.entries(checks))for(const [name,ok] of items)if(!ok)failed.push(`${group}.${name}`);
must(failed.length===0,'RC40 surface audit failed: '+failed.join(', '));
console.log(JSON.stringify({ok:true,groups:Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,v.length])),total:Object.values(checks).flat().length},null,2));
