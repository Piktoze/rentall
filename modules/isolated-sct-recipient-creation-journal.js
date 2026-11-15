// Isolated SCT TEST Accounts v2 recipient creation journal.
// No real user data or Stripe secrets stored. Never installed by the public server.
// Every reservation is a one-shot network attempt, including uncertain failures.
const isSupplierId=v=>typeof v==='string'&&/^synthetic-supplier-[A-Za-z0-9-]+$/.test(v);
const isAccountId=v=>typeof v==='string'&&/^acct_[A-Za-z0-9]+$/.test(v);

export function installIsolatedSctRecipientCreationJournal(db){
  db.exec(`CREATE TABLE IF NOT EXISTS sct_test_recipient_creation_commands(
    supplier_id TEXT PRIMARY KEY,
    legal_entity_type TEXT NOT NULL CHECK(legal_entity_type IN ('individual','company')),
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK(status IN ('reserved','reconcile_required','created_pending_onboarding')),
    stripe_account_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}
export function reserveIsolatedSctRecipientCreation(db,{supplierId,entityType}={}){
  if(!db?.transaction||!isSupplierId(supplierId)||
     !['individual','company'].includes(entityType))
    return {blocked:'synthetic_supplier_and_entity_required'};
  const key=`sct-test-recipient:${supplierId}:v1`;
  return db.transaction(()=>{
    const existing=db.prepare(`SELECT status,stripe_account_id
      FROM sct_test_recipient_creation_commands WHERE supplier_id=?`).get(supplierId);
    if(existing)return {blocked:'recipient_command_requires_reconciliation',
      status:existing.status,accountId:existing.stripe_account_id||null};
    db.prepare(`INSERT INTO sct_test_recipient_creation_commands
      (supplier_id,legal_entity_type,idempotency_key,status)
      VALUES(?,?,?,'reserved')`).run(supplierId,entityType,key);
    return {status:'reserved',idempotencyKey:key};
  }).immediate();
}
export function markIsolatedSctRecipientCreationUncertain(db,supplierId){
  if(!isSupplierId(supplierId))return false;
  return db.prepare(`UPDATE sct_test_recipient_creation_commands SET
    status='reconcile_required',updated_at=CURRENT_TIMESTAMP
    WHERE supplier_id=? AND status='reserved'`).run(supplierId).changes===1;
}
export function recordIsolatedSctRecipientCreated(db,{supplierId,entityType,accountId}={}){
  if(!isSupplierId(supplierId)||!isAccountId(accountId)||
     !['individual','company'].includes(entityType))
    return {blocked:'invalid_recipient_creation_proof'};
  return db.transaction(()=>{
    const row=db.prepare(`SELECT status,legal_entity_type,stripe_account_id
      FROM sct_test_recipient_creation_commands WHERE supplier_id=?`).get(supplierId);
    if(!row||row.status!=='reconcile_required'||row.legal_entity_type!==entityType||
       row.stripe_account_id!=null)
      return {blocked:'recipient_creation_not_reconcilable'};
    try{
      const updated=db.prepare(`UPDATE sct_test_recipient_creation_commands SET
        status='created_pending_onboarding',stripe_account_id=?,
        updated_at=CURRENT_TIMESTAMP WHERE supplier_id=? AND status='reconcile_required'
        AND stripe_account_id IS NULL`).run(accountId,supplierId);
      if(updated.changes!==1)return {blocked:'recipient_creation_changed'};
    }catch(e){
      if(String(e?.code||'').startsWith('SQLITE_CONSTRAINT'))
        return {blocked:'recipient_account_already_claimed'};
      throw e;
    }
    return {status:'created_pending_onboarding',accountId,
      recipientTransfersReady:false,bankPayoutsReady:false};
  }).immediate();
}
