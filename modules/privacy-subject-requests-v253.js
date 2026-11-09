// GDPR Article 12–22 request intake; no automated deletion or disclosure.
import crypto from 'node:crypto';

const ALLOWED = new Set(['access','rectification','erasure','restriction','portability','objection']);
export function registerPrivacyRequestRoutes(app, db, requireAuth) {
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
    updated_at AS updatedAt FROM privacy_subject_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`);
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
    r.created_at AS createdAt, r.updated_at AS updatedAt
    FROM privacy_subject_requests r LEFT JOIN app_users u ON u.user_id=r.user_id
    ORDER BY r.created_at DESC LIMIT 100`);
  const findRequest=db.prepare('SELECT request_id AS requestId, status FROM privacy_subject_requests WHERE request_id=?');
  const updateStatus=db.prepare(`UPDATE privacy_subject_requests SET status=?, updated_at=CURRENT_TIMESTAMP WHERE request_id=? AND status=?`);
  const insertAudit=db.prepare(`INSERT INTO privacy_subject_request_audit
    (audit_id,request_id,actor_user_id,action,previous_status,next_status) VALUES (?,?,?,?,?,?)`);
  const adminOnly=(req,res,next)=>req.appUser?.role==='admin'?next():res.status(403).json({code:'FORBIDDEN',error:'Prieiga draudžiama'});
  app.get('/api/admin/privacy/requests',requireAuth,adminOnly,(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.json({requests:allRequests.all()});
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
    if(['completed','rejected'].includes(status) && req.body?.reviewConfirmed!==true)
      return res.status(400).json({code:'REVIEW_CONFIRMATION_REQUIRED'});
    const result=db.transaction(()=>{
      const updated=updateStatus.run(status,id,existing.status);
      if(updated.changes!==1)return false;
      insertAudit.run('dsra_'+crypto.randomUUID(),id,String(req.appUser.userId),
        'status_changed',existing.status,status);
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
    res.status(201).json({requestId,type,status:'received',
      notice:'Prašymas užregistruotas. Tai nėra automatinis duomenų ištrynimas ar eksportas. Atsakymas bus pateiktas po tapatybės ir teisinių pagrindų patikros.'});
  });
}
