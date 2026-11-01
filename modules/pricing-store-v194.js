import crypto from 'crypto';
import {DEFAULT_STARTER_PLAN,calculateSupplierPricing,pricingSnapshot} from './pricing-v194.js';

function addColumnIfMissing(db,sql){
  try{db.exec(sql)}catch(err){
    if(!String(err?.message||'').includes('duplicate column name')) throw err;
  }
}

export function installSupplierPricingSchema(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_plans (
      plan_id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      monthly_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(monthly_fee_cents >= 0),
      commission_bps INTEGER NOT NULL CHECK(commission_bps >= 0 AND commission_bps <= 10000),
      currency TEXT NOT NULL DEFAULT 'EUR',
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      stripe_price_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS supplier_subscriptions (
      subscription_id TEXT PRIMARY KEY,
      supplier_user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','trialing','past_due','cancelled','expired')),
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(cancel_at_period_end IN (0,1)),
      stripe_subscription_id TEXT,
      stripe_customer_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_user_id) REFERENCES app_users(user_id),
      FOREIGN KEY(plan_id) REFERENCES supplier_plans(plan_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_active_subscription
      ON supplier_subscriptions(supplier_user_id)
      WHERE status IN ('active','trialing','past_due');

    CREATE INDEX IF NOT EXISTS idx_supplier_subscriptions_plan
      ON supplier_subscriptions(plan_id,status);
  `);

  addColumnIfMissing(db,`ALTER TABLE rental_bookings ADD COLUMN pricing_plan_code TEXT`);
  addColumnIfMissing(db,`ALTER TABLE rental_bookings ADD COLUMN pricing_commission_bps INTEGER`);
  addColumnIfMissing(db,`ALTER TABLE rental_bookings ADD COLUMN pricing_monthly_fee_cents INTEGER DEFAULT 0`);
  addColumnIfMissing(db,`ALTER TABLE rental_bookings ADD COLUMN pricing_snapshot_json TEXT`);

  db.prepare(`
    INSERT INTO supplier_plans(plan_id,code,name,monthly_fee_cents,commission_bps,currency,active)
    VALUES(@plan_id,@code,@name,@monthly_fee_cents,@commission_bps,@currency,1)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      monthly_fee_cents=excluded.monthly_fee_cents,
      commission_bps=excluded.commission_bps,
      currency=excluded.currency,
      active=1,
      updated_at=CURRENT_TIMESTAMP
  `).run({
    plan_id:'plan_starter',
    code:DEFAULT_STARTER_PLAN.code,
    name:DEFAULT_STARTER_PLAN.name,
    monthly_fee_cents:DEFAULT_STARTER_PLAN.monthlyFeeCents,
    commission_bps:DEFAULT_STARTER_PLAN.commissionBps,
    currency:DEFAULT_STARTER_PLAN.currency
  });

  // Existing suppliers are grandfathered onto the launch STARTER plan.
  db.exec(`
    INSERT OR IGNORE INTO supplier_subscriptions(
      subscription_id,supplier_user_id,plan_id,status,started_at
    )
    SELECT
      'sub_starter_' || user_id,
      user_id,
      'plan_starter',
      'active',
      CURRENT_TIMESTAMP
    FROM app_users
    WHERE role='supplier';
  `);

  db.prepare(`INSERT OR IGNORE INTO schema_migrations(version,name) VALUES(183,'v194-supplier-pricing-foundation')`).run();
}

function planRowToModel(row){
  if(!row) return DEFAULT_STARTER_PLAN;
  return Object.freeze({
    planId:row.plan_id,
    code:row.code,
    name:row.name,
    monthlyFeeCents:Number(row.monthly_fee_cents||0),
    commissionBps:Number(row.commission_bps),
    currency:String(row.currency||'EUR'),
    active:Boolean(row.active),
    subscriptionStatus:row.subscription_status||null,
    subscriptionId:row.subscription_id||null
  });
}

export function ensureStarterSubscriptionForSupplier(db,{supplierUserId=null,supplierEmail=null}={}){
  let user=null;
  if(supplierUserId){
    user=db.prepare(`SELECT user_id,email,role FROM app_users WHERE user_id=?`).get(String(supplierUserId));
  }else if(supplierEmail){
    user=db.prepare(`SELECT user_id,email,role FROM app_users WHERE email=? COLLATE NOCASE`).get(String(supplierEmail).trim());
  }
  if(!user || user.role!=='supplier') return null;

  const existing=db.prepare(`
    SELECT subscription_id FROM supplier_subscriptions
    WHERE supplier_user_id=? AND status IN ('active','trialing','past_due')
    ORDER BY started_at DESC LIMIT 1
  `).get(user.user_id);
  if(existing) return existing.subscription_id;

  const subscriptionId=`sub_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO supplier_subscriptions(
      subscription_id,supplier_user_id,plan_id,status,started_at,created_at,updated_at
    ) VALUES(?,?,'plan_starter','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
  `).run(subscriptionId,user.user_id);
  return subscriptionId;
}

export function getSupplierPricingPlan(db,{supplierUserId=null,supplierEmail=null}={}){
  if(!supplierUserId&&!supplierEmail) return DEFAULT_STARTER_PLAN;
  ensureStarterSubscriptionForSupplier(db,{supplierUserId,supplierEmail});
  const where=supplierUserId?'u.user_id=?':'u.email=? COLLATE NOCASE';
  const value=supplierUserId?String(supplierUserId):String(supplierEmail).trim();
  const row=db.prepare(`
    SELECT
      p.plan_id,p.code,p.name,p.monthly_fee_cents,p.commission_bps,p.currency,p.active,
      s.subscription_id,s.status AS subscription_status
    FROM app_users u
    JOIN supplier_subscriptions s ON s.supplier_user_id=u.user_id
    JOIN supplier_plans p ON p.plan_id=s.plan_id
    WHERE ${where}
      AND u.role='supplier'
      AND s.status IN ('active','trialing','past_due')
      AND p.active=1
    ORDER BY
      CASE s.status WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 ELSE 2 END,
      s.started_at DESC
    LIMIT 1
  `).get(value);
  return planRowToModel(row);
}

export function calculateBookingPricingForSupplier(db,{supplierUserId=null,supplierEmail=null,bookingAmountCents}={}){
  const plan=getSupplierPricingPlan(db,{supplierUserId,supplierEmail});
  const result=calculateSupplierPricing({bookingAmountCents,plan,pricingSource:'supplier_plan'});
  return {...result,snapshot:pricingSnapshot(result)};
}

export function saveBookingPricingSnapshot(db,{bookingId,pricing}={}){
  if(!bookingId) throw new Error('bookingId is required');
  const snap=pricingSnapshot(pricing?.snapshot||pricing);
  const result=db.prepare(`
    UPDATE rental_bookings
    SET pricing_plan_code=?,
        pricing_commission_bps=?,
        pricing_monthly_fee_cents=?,
        pricing_snapshot_json=?,
        platform_fee_amount=?,
        supplier_amount=?,
        updated_at=CURRENT_TIMESTAMP
    WHERE booking_id=?
  `).run(
    snap.planCode,
    snap.commissionBps,
    snap.monthlyFeeCents,
    JSON.stringify(snap),
    snap.commissionAmountCents/100,
    snap.supplierAmountCents/100,
    String(bookingId)
  );
  if(result.changes!==1) throw new Error('Booking not found while saving pricing snapshot');
  return snap;
}

export function getBookingPricingSnapshot(db,bookingId){
  const row=db.prepare(`
    SELECT pricing_snapshot_json FROM rental_bookings WHERE booking_id=?
  `).get(String(bookingId));
  if(!row?.pricing_snapshot_json) return null;
  try{return JSON.parse(row.pricing_snapshot_json)}catch{return null}
}
