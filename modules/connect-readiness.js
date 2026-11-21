// Read-only provider proof. Receiving a transfer and receiving a bank payout are distinct.
export async function inspectBankPayoutReadiness(stripe,accountId,livemode){
 const account=await stripe.accounts.retrieve(accountId);
 if(account?.id!==accountId||account.livemode!==undefined&&account.livemode!==livemode)throw Error('CONNECT_BANK_ACCOUNT_MODE_MISMATCH');
 const banks=await stripe.accounts.listExternalAccounts(accountId,{object:'bank_account',limit:100});
 if(banks.has_more!==false||!Array.isArray(banks.data))throw Error('CONNECT_BANK_LIST_INCOMPLETE');
 const requirements=account.requirements;
 const clear=requirements&&Array.isArray(requirements.currently_due)&&Array.isArray(requirements.past_due)&&Array.isArray(requirements.pending_verification)&&!requirements.currently_due.length&&!requirements.past_due.length&&!requirements.pending_verification.length&&!requirements.disabled_reason;
 const bank=banks.data.find(x=>x.object==='bank_account'&&x.currency==='eur'&&x.default_for_currency===true&&['new','validated','verified'].includes(x.status)&&Array.isArray(x.available_payout_methods)&&x.available_payout_methods.includes('standard')&&(!x.requirements?.currently_due?.length)&&(!x.requirements?.errors?.length));
 return {bankPayoutsReady:!!(account.payouts_enabled===true&&clear&&bank),payoutsEnabled:account.payouts_enabled===true,
  bankPayoutReadiness:account.payouts_enabled&&clear&&bank?'ready':'needs_review',bankStatus:bank?.status||'not_verified',bankPayoutExecuted:false,bankOwnershipVerified:false,payoutSchedule:account.settings?.payouts?.schedule||null};
}
export function createConnectPayoutReconciler({db,stripe,livemode}){
 db.exec(`CREATE TABLE IF NOT EXISTS connect_payout_events(event_id TEXT PRIMARY KEY,account_id TEXT NOT NULL,payout_id TEXT NOT NULL,event_type TEXT NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS connect_bank_payouts(account_id TEXT NOT NULL,payout_id TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,checked_at TEXT NOT NULL,PRIMARY KEY(account_id,payout_id));`);
 const inFlight=new Set();
 return async(event)=>{
  if(!['payout.paid','payout.failed','payout.updated','payout.canceled','payout.created'].includes(event.type))return {handled:false};
  if(event.livemode!==livemode||!/^acct_[A-Za-z0-9]+$/.test(event.account||''))throw Error('CONNECT_EVENT_SOURCE_MISMATCH');
  const owner=db.prepare('SELECT user_id FROM stripe_connections WHERE stripe_account_id=? AND connect_api=?').all(event.account,'v2_recipient_sct_'+(livemode?'live':'test'));
  if(owner.length!==1)throw Error('CONNECT_PAYOUT_OWNER_NOT_VERIFIED');
  const id=event.data?.object?.id;if(!/^po_[A-Za-z0-9]+$/.test(id||''))throw Error('CONNECT_PAYOUT_ID_INVALID');
  const previous=db.prepare('SELECT * FROM connect_payout_events WHERE event_id=?').get(event.id);
  if(previous&&(previous.account_id!==event.account||previous.payout_id!==id||previous.event_type!==event.type))throw Error('CONNECT_EVENT_ID_CONFLICT');
  if(previous?.state==='processed')return {handled:true,duplicate:true};
  const lock=event.account+':'+id;if(inFlight.has(lock))throw Error('CONNECT_PAYOUT_RECONCILIATION_BUSY');inFlight.add(lock);
  try{
  const p=await stripe.payouts.retrieve(id,{}, {stripeAccount:event.account});
  if(p.id!==id||p.livemode!==livemode||p.currency!=='eur'||!Number.isSafeInteger(p.amount)||p.amount<=0||!['pending','in_transit','paid','failed','canceled'].includes(p.status))throw Error('CONNECT_PAYOUT_READBACK_INVALID');
  db.transaction(()=>{
   db.prepare('INSERT INTO connect_bank_payouts VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,payout_id) DO UPDATE SET status=excluded.status,checked_at=excluded.checked_at').run(event.account,p.id,p.amount,p.currency,p.status,new Date().toISOString());
   db.prepare("INSERT INTO connect_payout_events VALUES(?,?,?,?,'processed') ON CONFLICT(event_id) DO UPDATE SET state='processed'").run(event.id,event.account,id,event.type);
  }).immediate();return {handled:true,status:p.status,bankPayoutExecuted:p.status==='paid',bankReceiptConfirmed:false};
  }finally{inFlight.delete(lock);}
 };
}
