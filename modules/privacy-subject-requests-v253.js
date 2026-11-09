// GDPR Article 12–22 request intake; no automated deletion or disclosure.
import crypto from 'node:crypto';

const ALLOWED = new Set(['access','rectification','erasure','restriction','portability','objection']);
export function registerPrivacyRequestRoutes(app, db, requireAuth, enqueueEmail=null) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS privacy_subject_requests (
      request_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      request_type TEXT NOT NULL CHECK(request_type IN ('access','rectification','erasure','restriction','portability','objection')),
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received','in_review','awaiting_verification','completed','rejected')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_privacy_subject_request_user
      ON privacy_subject_requests(user_id, created_at DESC);
  `);
  const list = db.prepare(`SELECT request_id AS requestId, request_type AS type, status, created_at AS createdAt,
    updated_at AS updatedAt, datetime(created_at, '+1 month') AS dueAt FROM privacy_subject_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);
  const countRecent = db.prepare(`SELECT COUNT(*) AS count FROM privacy_subject_requests
    WHERE user_id = ? AND created_at > datetime('now', '-1 day')`);
  const insert = db.prepare(`INSERT INTO privacy_subject_requests
    (request_id, user_id, request_type, details) VALUES (?, ?, ?, ?)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS privacy_subject_request_audit (
      audit_id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      next_status TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(request_id) REFERENCES privacy_subject_requests(request_id)
    );
    CREATE INDEX IF NOT EXISTS idx_privacy_request_audit_request ON privacy_subject_request_audit(request_id,created_at);
  `);
  const allRequests=db.prepare(`SELECT r.request_id AS requestId, r.user_id AS userId,
    u.email AS accountEmail, r.request_type AS type, r.details, r.status,
    r.created_at AS createdAt, r.updated_at AS updatedAt,
    datetime(r.created_at, '+1 month') AS dueAt,
    CASE WHEN r.status NOT IN ('completed','rejected') AND datetime(r.created_at, '+1 month') < datetime('now') THEN 1 ELSE 0 END AS overdue
    FROM privacy_subject_requests r LEFT JOIN app_users u ON u.user_id=r.user_id
    ORDER BY
      CASE WHEN r.status IN ('completed','rejected') THEN 1 ELSE 0 END ASC,
      CASE WHEN r.status NOT IN ('completed','rejected') THEN datetime(r.created_at, '+1 month') END ASC,
      r.created_at DESC, r.request_id DESC LIMIT ? OFFSET ?`);
  const findRequest=db.prepare('SELECT request_id AS requestId, status FROM privacy_subject_requests WHERE request_id=?');
  try{db.exec('ALTER TABLE privacy_subject_request_audit ADD COLUMN resolution_note TEXT')}catch(e){if(!String(e.message).includes('duplicate column name'))throw e}
  for(const column of ['review_confirmed','response_sent','identity_reviewed','action_performed']){
    try{db.exec('ALTER TABLE privacy_subject_request_audit ADD COLUMN '+column+' INTEGER NOT NULL DEFAULT 0')}
    catch(e){if(!String(e.message).includes('duplicate column name'))throw e}
  }
  const updateStatus=db.prepare(`UPDATE privacy_subject_requests SET status=?, updated_at=CURRENT_TIMESTAMP WHERE request_id=? AND status=?`);
  const insertAudit=db.prepare(`INSERT INTO privacy_subject_request_audit
    (audit_id,request_id,actor_user_id,action,previous_status,next_status,resolution_note,review_confirmed,response_sent,identity_reviewed,action_performed) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const adminOnly=(req,res,next)=>req.appUser?.role==='admin'?next():res.status(403).json({code:'FORBIDDEN',error:'Prieiga draudžiama'});
  const requestAudit=db.prepare(`SELECT audit_id AS auditId, actor_user_id AS actorUserId, action,
    previous_status AS previousStatus, next_status AS nextStatus,
    resolution_note AS resolutionNote, review_confirmed AS reviewConfirmed, response_sent AS responseSent, identity_reviewed AS identityReviewed, action_performed AS actionPerformed, created_at AS createdAt
    FROM privacy_subject_request_audit WHERE request_id=?
    ORDER BY created_at ASC, rowid ASC LIMIT 200`);
  app.get('/api/admin/privacy/requests/:requestId/audit',requireAuth,adminOnly,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const id=String(req.params.requestId||'');
    if(!/^dsr_[0-9a-f-]{36}$/.test(id))
      return res.status(400).json({code:'INVALID_REQUEST_ID'});
    if(!findRequest.get(id))return res.status(404).json({code:'NOT_FOUND'});
    res.json({requestId:id,events:requestAudit.all(id)});
  });

  // Admin-only operational health: aggregate counts, never expose request details or secrets.
  const summary=db.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status='received' THEN 1 ELSE 0 END) AS unreviewed,
    SUM(CASE WHEN status NOT IN ('completed','rejected') THEN 1 ELSE 0 END) AS open,
    SUM(CASE WHEN status NOT IN ('completed','rejected')
       AND datetime(created_at, '+1 month') < datetime('now') THEN 1 ELSE 0 END) AS overdue,
    MIN(CASE WHEN status NOT IN ('completed','rejected')
       THEN datetime(created_at, '+1 month') ELSE NULL END) AS earliestDueAt
    FROM privacy_subject_requests`);
  app.get('/api/admin/privacy/health',requireAuth,adminOnly,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const row=summary.get();
    const notificationAddressConfigured=Boolean(String(process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL||'').trim());
    const emailWorkerEnabled=process.env.EMAIL_WORKER_ENABLED==='true';
    const emailProviderConfigured=Boolean(String(process.env.EMAIL_PROVIDER||'').trim()) &&
      process.env.EMAIL_PROVIDER!=='console';
    res.json({
      total:Number(row.total||0),unreviewed:Number(row.unreviewed||0),
      open:Number(row.open||0),overdue:Number(row.overdue||0),
      earliestDueAt:row.earliestDueAt||null,
      notificationAddressConfigured,emailWorkerEnabled,emailProviderConfigured,
      automaticDeliveryReady:notificationAddressConfigured&&emailWorkerEnabled&&emailProviderConfigured,
      warning:'Būsenos kontrolė nepakeičia juridinio prašymo įvertinimo, termino patikros ar atsakymo pateikimo.'
    });
  });
  app.get('/api/admin/privacy/requests',requireAuth,adminOnly,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const rawOffset=String(req.query?.offset??'0');
    if(!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset))
      return res.status(400).json({code:'INVALID_OFFSET'});
    const offset=Number(rawOffset);
    const pageSize=50;
    const rows=allRequests.all(pageSize+1,offset);
    res.json({requests:rows.slice(0,pageSize),hasMore:rows.length>pageSize,nextOffset:offset+pageSize});
  });
  app.post('/api/admin/privacy/requests/:requestId/status',requireAuth,adminOnly,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const status=String(req.body?.status||'');
    const allowed=new Set(['in_review','awaiting_verification','completed','rejected']);
    if(!allowed.has(status))return res.status(400).json({code:'INVALID_STATUS'});
    const id=String(req.params.requestId||'');
    const existing=findRequest.get(id);
    if(!existing)return res.status(404).json({code:'NOT_FOUND'});
    if(['completed','rejected'].includes(existing.status))return res.status(409).json({code:'ALREADY_CLOSED'});
    // A workflow state change does not perform erasure, export, or disclosure.
    const terminal=['completed','rejected'].includes(status);
    if(terminal && req.body?.reviewConfirmed!==true)
      return res.status(400).json({code:'REVIEW_CONFIRMATION_REQUIRED'});
    // Explicit human workflow checkpoints. No personal identity documents or exports are uploaded.
    if(terminal && req.body?.responseSent!==true)
      return res.status(400).json({code:'RESPONSE_NOT_CONFIRMED',error:'Patvirtinkite, kad sprendimas faktiškai išsiųstas duomenų subjektui.'});
    if(status==='completed' && req.body?.identityReviewed!==true)
      return res.status(400).json({code:'IDENTITY_REVIEW_REQUIRED',error:'Prieš vykdymą patikrinkite prašytojo tapatybės / teisės į duomenis pagrindą.'});
    if(status==='completed' && req.body?.actionPerformed!==true)
      return res.status(400).json({code:'ACTION_NOT_CONFIRMED',error:'Patvirtinkite, kad prašoma duomenų tvarkymo operacija realiai atlikta arba teisėtai išspręsta.'});
    const resolutionNote=String(req.body?.resolutionNote||'').trim();
    if(terminal && (resolutionNote.length<20 || resolutionNote.length>2000))
      return res.status(400).json({code:'RESOLUTION_NOTE_REQUIRED',error:'Nurodykite peržiūros sprendimo ir atsakymo registravimo duomenis (20–2000 ženklų).'});
    if(!terminal && resolutionNote.length>2000)return res.status(400).json({code:'INVALID_NOTE'});
    const result=db.transaction(()=>{
      const updated=updateStatus.run(status,id,existing.status);
      if(updated.changes!==1)return false;
      insertAudit.run('dsra_'+crypto.randomUUID(),id,String(req.appUser.userId),
        'status_changed',existing.status,status,resolutionNote,
        Number(terminal && req.body?.reviewConfirmed===true),Number(terminal && req.body?.responseSent===true),
        Number(status==='completed' && req.body?.identityReviewed===true),
        Number(status==='completed' && req.body?.actionPerformed===true));
      return true;
    })();
    if(!result)return res.status(409).json({code:'CONFLICT'});
    res.json({requestId:id,status});
  });

  app.get('/api/privacy/requests', requireAuth, (req, res) => {
    res.setHeader('Cache-Control','no-store');
    res.json({requests:list.all(String(req.appUser.userId))});
  });
  app.post('/api/privacy/requests', requireAuth, (req, res) => {
    res.setHeader('Cache-Control','no-store');
    const type = String(req.body?.type ?? '');
    const details = String(req.body?.details ?? '').trim();
    if (!ALLOWED.has(type) || details.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(details)) {
      return res.status(400).json({code:'INVALID_PRIVACY_REQUEST',error:'Neteisingas prašymo tipas ar tekstas'});
    }
    if (countRecent.get(String(req.appUser.userId)).count >= 5)
      return res.status(429).json({code:'PRIVACY_REQUEST_LIMIT',error:'Prašymų limitas pasiektas. Susisiekite su duomenų valdytoju.'});
    const requestId='dsr_'+crypto.randomUUID();
    insert.run(requestId,String(req.appUser.userId),type,details);
    // Only enqueue a minimal operational notification when an operator address is configured.
    // Do not send request details or account contact data by email.
    const operatorAddress=String(process.env.PRIVACY_REQUESTS_NOTIFY_EMAIL||'').trim();
    if(operatorAddress && typeof enqueueEmail==='function'){
      try{
        enqueueEmail({recipient:operatorAddress,templateKey:'privacy_request_notify',
          subject:'RentInOrbit · Naujas duomenų subjekto prašymas',
          payload:{requestId,type,reviewPath:'/?privacy-requests=1'},
          dedupeKey:'privacy-request:'+requestId});
      }catch(error){
        console.error(JSON.stringify({type:'privacy_request_notification_failure',requestId,
          errorCode:String(error?.code||'EMAIL_QUEUE_FAILED')}));
      }
    }else{
      console.warn(JSON.stringify({type:'privacy_request_operator_notification_not_configured',requestId}));
    }
    res.status(201).json({requestId,type,status:'received',
      notice:'Prašymas užregistruotas. Tai nėra automatinis duomenų ištrynimas ar eksportas. Atsakymas bus pateiktas po tapatybės ir teisinių pagrindų patikros.'});
  });
}
