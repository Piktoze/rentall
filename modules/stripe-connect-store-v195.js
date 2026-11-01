function addColumnIfMissing(db,sql){
  try{db.exec(sql)}catch(err){
    if(!String(err?.message||'').includes('duplicate column name')) throw err;
  }
}

export function installStripeDirectChargeSchema(db){
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN merchant_capability_status TEXT DEFAULT 'unknown'`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN dashboard TEXT DEFAULT 'express'`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN fees_collector TEXT DEFAULT 'stripe'`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN losses_collector TEXT DEFAULT 'stripe'`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN onboarding_status TEXT DEFAULT 'not_started'`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN country TEXT`);
  addColumnIfMissing(db,`ALTER TABLE stripe_connections ADD COLUMN entity_type TEXT`);
  db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(184,'v195-direct-charges-accounts-v2')`).run();
}

export function saveDirectMerchantMetadata(db,{
  userId,
  accountId,
  merchantCapabilityStatus='unknown',
  dashboard='express',
  feesCollector='stripe',
  lossesCollector='stripe',
  onboardingStatus='pending',
  country=null,
  entityType=null,
  requirements=[]
}={}){
  const result=db.prepare(`
    UPDATE stripe_connections
    SET connect_api='v2_merchant_direct',
        merchant_capability_status=@merchant_capability_status,
        dashboard=@dashboard,
        fees_collector=@fees_collector,
        losses_collector=@losses_collector,
        onboarding_status=@onboarding_status,
        country=COALESCE(@country,country),
        entity_type=COALESCE(@entity_type,entity_type),
        requirements_json=@requirements_json,
        updated_at=CURRENT_TIMESTAMP
    WHERE user_id=@user_id AND stripe_account_id=@stripe_account_id
  `).run({
    user_id:String(userId),
    stripe_account_id:String(accountId),
    merchant_capability_status:String(merchantCapabilityStatus||'unknown'),
    dashboard:String(dashboard||'express'),
    fees_collector:String(feesCollector||'stripe'),
    losses_collector:String(lossesCollector||'stripe'),
    onboarding_status:String(onboardingStatus||'pending'),
    country:country?String(country).toUpperCase():null,
    entity_type:entityType?String(entityType).toLowerCase():null,
    requirements_json:JSON.stringify(Array.isArray(requirements)?requirements:[])
  });
  if(result.changes!==1) throw new Error('Stripe connected account row was not found');
  return getDirectMerchantConnectionByUserId(db,userId);
}

const selectColumns=`
  user_id AS userId,
  user_email AS userEmail,
  stripe_account_id AS stripeAccountId,
  connect_api AS connectApi,
  merchant_capability_status AS merchantCapabilityStatus,
  dashboard,
  fees_collector AS feesCollector,
  losses_collector AS lossesCollector,
  onboarding_status AS onboardingStatus,
  country,
  entity_type AS entityType,
  requirements_json AS requirementsJson,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

export function getDirectMerchantConnectionByUserId(db,userId){
  return db.prepare(`SELECT ${selectColumns} FROM stripe_connections WHERE user_id=?`).get(String(userId))||null;
}

export function getDirectMerchantConnectionByEmail(db,email){
  return db.prepare(`SELECT ${selectColumns} FROM stripe_connections WHERE user_email=? COLLATE NOCASE`).get(String(email||'').trim())||null;
}

export function directMerchantReady(connection){
  return !!connection &&
    String(connection.connectApi)==='v2_merchant_direct' &&
    String(connection.merchantCapabilityStatus)==='active' &&
    String(connection.lossesCollector)==='stripe' &&
    String(connection.feesCollector)==='stripe';
}
