#!/usr/bin/env bash
# Back up the kitten-app SQLite DB (online-safe VACUUM INTO) and the photos
# volume. Run on the Docker host, e.g. nightly via cron:
#   0 3 * * * /home/danny/Documents/repos/kitten_app/scripts/backup.sh >> /home/danny/kitten-backups/backup.log 2>&1
set -euo pipefail
umask 077

APP_CONTAINER="${APP_CONTAINER:-kitten-app}"
PHOTOS_VOLUME="${PHOTOS_VOLUME:-kitten_app_kitten-photos}"
DEST="${BACKUP_DIR:-$HOME/kitten-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"
chmod 700 "$DEST"

# 1) DB — online backup via VACUUM INTO inside the container (safe on a live DB,
#    unlike a naive cp), then copy the consistent snapshot out.
docker exec "$APP_CONTAINER" node -e \
  "process.umask(0o077); const d=require('better-sqlite3')(process.env.DATABASE_PATH); d.exec(\"VACUUM INTO '/data/_backup.db'\"); d.close(); require('node:fs').chmodSync('/data/_backup.db', 0o600);"
docker cp "$APP_CONTAINER:/data/_backup.db" "$DEST/kittens-$TS.db"
chmod 600 "$DEST/kittens-$TS.db"
docker exec "$APP_CONTAINER" rm -f /data/_backup.db

# 2) Photos — tar the volume read-only.
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PHOTOS_VOLUME:/photos:ro" -v "$DEST:/backup" alpine \
  sh -c 'set -eu; umask 077; tar czf "$1" -C /photos .; chmod 600 "$1"' \
  sh "/backup/photos-$TS.tgz"
chmod 600 "$DEST/photos-$TS.tgz"

# 3) Retention — drop backups older than RETAIN_DAYS days.
find "$DEST" -name 'kittens-*.db' -mtime +"$RETAIN_DAYS" -delete
find "$DEST" -name 'photos-*.tgz' -mtime +"$RETAIN_DAYS" -delete

echo "[$(date -Iseconds)] Backup OK: $DEST/kittens-$TS.db + photos-$TS.tgz"
