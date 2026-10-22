# Backup / recovery

1. Stop writes or put the service in maintenance mode.
2. Run `npm run backup:db` and copy the resulting file to durable off-host storage.
3. Verify it with `npm run backup:verify -- backups/<file>.db`.
4. Recovery: stop RentAll, preserve the damaged DB, restore a verified backup to `DB_PATH`, then start the service.
5. Confirm `/api/health` and `/api/launch-readiness`, then perform a booking read/write smoke test.

A local backup is **not** a disaster-recovery strategy by itself. Production must schedule encrypted off-host backups and periodically test restoration.
