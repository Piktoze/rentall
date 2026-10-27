# RentInOrbit RC45 Railway production deployment

RC45 uses Railway Infrastructure as Code in `.railway/railway.ts`. It declares the GitHub `Piktoze/rentinorbit` `main` source, one European web replica, one 1 GB persistent volume mounted at `/data`, `npm start`, and `/api/readiness` as the deployment health check. `railway.toml` remains only as a compatibility fallback for an already-existing legacy service; Railway has deprecated that format for new services.

## Storage and startup contract

- Keep exactly one application replica while RentInOrbit uses SQLite. Multiple replicas cannot safely share a SQLite volume.
- The volume mount is exactly `/data`. Railway supplies `RAILWAY_VOLUME_MOUNT_PATH=/data` automatically when the declared volume is attached; do not create or override that variable manually.
- Set `RENTINORBIT_DB_PATH=/data/rentinorbit.sqlite` and `UPLOADS_DIR=/data/uploads`. Leave `DATABASE_URL` and `DB_PATH` unset. As an alternative outside the supplied IaC, `DATABASE_URL=sqlite:///data/rentinorbit.sqlite` is accepted only when the other DB-path variables are unset.
- Migrations run idempotently inside `npm start`, after Railway mounts the volume. Do not move SQLite migrations to Railway's pre-deploy command: Railway does not mount volumes in pre-deploy containers.
- Startup fails before listening if the volume is absent, not a directory, not writable, or the selected database/uploads directory is outside the mounted volume. Readiness stays closed until migration 172 and a live database query succeed. Listing uploads are therefore durable on the same Railway volume.

## Required Railway service variables

The IaC file supplies safe literals such as `NODE_ENV`, `RENTINORBIT_DB_PATH`, provider modes, and worker enablement. Add the following preserved values in Railway Variables before the first deploy:

```text
APP_URL=https://rentinorbit.com
PUBLIC_BASE_URL=https://rentinorbit.com
SESSION_SECRET=<32+-character cryptographically-random value>

STRIPE_MODE=test
STRIPE_SECRET_KEY=<mode-matched restricted rk_ key where permissions allow>
STRIPE_PUBLISHABLE_KEY=<mode-matched pk_ key>
STRIPE_WEBHOOK_SECRET=<endpoint-specific whsec_ secret>
STRIPE_CONNECT_V2_PROVISIONING=true

EMAIL_FROM=RentInOrbit <bookings@verified-sending-domain>
RESEND_API_KEY=<re_ key>
EMAIL_WORKER_TOKEN=<different 32+-character cryptographically-random value>
SUPPORT_EMAIL=<monitored mailbox>
```

`STRIPE_CONNECT_V2_PROVISIONING=true` is valid only after Accounts v2 recipient provisioning and the `stripe_transfers` capability gate have been verified in the corresponding Stripe sandbox/live account. Use separate Stripe sandboxes, keys, and webhook endpoints for staging and production. Register `POST /api/stripe/webhook`; signed webhooks remain mandatory and provider events remain the payment/deposit source of truth.

Prefer a least-privilege Stripe restricted key and store all secret values only in Railway Variables. Never place a Stripe secret or restricted key in frontend variables, source files, build arguments, or smoke-test output.

## Optional integrations

- The IaC default is `MAPS_PROVIDER=stub`, which preserves the production-safe map fallback. To enable a supported live map provider, set `MAPS_PROVIDER=mapbox` or `google` and add the browser-safe `MAPS_PUBLIC_TOKEN`.
- Keep `SMS_PROVIDER=disabled` and `PUSH_PROVIDER=disabled`; RC45 deliberately refuses unsupported notification-provider claims. Transactional booking email is delivered through Resend.
- `OBJECT_STORAGE_PROVIDER` and `MONITORING_DSN` are not launch-authoritative in RC45. Uploaded listing media is durable on the single attached volume; move it to object storage before horizontal scaling.

## First deployment

1. Install Railway CLI 5.63 or newer and authenticate with `railway login`.
2. Link or create the intended Railway project and production environment.
3. Add the preserved variables above, enable public networking, and choose the generated/custom HTTPS domain for both URL variables.
4. Run `railway config plan` and verify it adds one `rentinorbit` service and one `rentinorbit-data` volume without deleting unrelated resources.
5. Run `railway config apply`. The service builds from GitHub `main`; startup initializes the mounted database and migration 172 before listening.
6. Confirm `/healthz` and `/api/readiness` return 200, then run `npm run smoke:production -- https://<domain>` from this repository.

## Operations, backup, and rollback

- `/healthz` is the process liveness endpoint. Railway uses `/api/readiness`, which additionally requires configuration, mounted storage, database connectivity, migration 172, and traffic acceptance.
- On SIGTERM, RentInOrbit stops workers, drains HTTP, checkpoints the SQLite WAL, and closes the database. The IaC service remains single-replica to avoid shared-SQLite corruption.
- Transactional email rows interrupted during delivery are safely returned to the retry queue on restart; shutdown briefly drains the active worker before closing SQLite.
- Enable Railway volume backups. Before schema-changing releases, also run `npm run backup:db` and `npm run backup:verify` from a service shell with an explicit backup target on persistent storage.
- Roll back application code without replacing the volume. Never overwrite a newer live database with an older file unless a tested restore plan explicitly requires it.
- If readiness fails, keep traffic closed and use only the returned check identifiers. Startup/readiness diagnostics expose modes and booleans, never secret values or the database path.

Railway references: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code/reference), [Volumes](https://docs.railway.com/volumes), and [Healthchecks](https://docs.railway.com/deployments/healthchecks).


## Required database backup gate before public production

Staging is exempt from the backup launch gate. Before switching to public production:

- Set `DB_BACKUP_ENABLED=true`.
- Schedule `npm run backup:auto` at least daily in an environment that can access the mounted `/data` volume.
- Keep backups under `/data/backups` or set `BACKUP_DIR` explicitly.
- The command uses SQLite online backup and runs `PRAGMA integrity_check`; success writes `/data/backups/last-verified-backup.json`.
- `/api/launch-readiness` blocks public production when no verified backup evidence exists or it is older than `DB_BACKUP_MAX_AGE_HOURS` (default 30 hours).
- An on-volume backup protects against application/schema mistakes but not total volume loss; copy verified backups to encrypted off-site storage as part of the production operations plan.
