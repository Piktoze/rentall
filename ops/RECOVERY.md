# Backup / recovery

1. Stop writes or put the service in maintenance mode.
2. Staging stores automatic verified backups on the separately mounted `/backups` volume, never below `/data`. Run `npm run backup:auto` for an on-demand verified copy.
3. Verify it with `npm run backup:verify -- backups/<file>.db`.
4. Test recovery without touching the live database with `npm run backup:restore-test`. It restores the latest verified backup into a unique temporary directory and runs `integrity_check`, table-count and migration checks.
5. Live recovery requires maintenance mode: stop RentInOrbit, preserve the damaged DB, copy a verified backup to `DB_PATH`, then start the service. Never overwrite a running SQLite database or restore only one of its WAL/SHM files.
6. Confirm `/api/healthz`, `/api/readiness` and `/api/launch-readiness`, then perform a booking read/write smoke test.

A local backup is **not** a disaster-recovery strategy by itself. Production must schedule encrypted off-host backups and periodically test restoration.
