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
