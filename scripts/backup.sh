#!/usr/bin/env bash
# Back up the kitten-app SQLite DB (online-safe VACUUM INTO) and the photos
# volume. Run on the Docker host, e.g. nightly via cron:
#   0 3 * * * /home/danny/Documents/repos/kitten_app/scripts/backup.sh >> /home/danny/kitten-backups/backup.log 2>&1
set -euo pipefail

APP_CONTAINER="${APP_CONTAINER:-kitten-app}"
PHOTOS_VOLUME="${PHOTOS_VOLUME:-kitten_app_kitten-photos}"
DEST="${BACKUP_DIR:-$HOME/kitten-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$DEST"

# 1) DB — online backup via VACUUM INTO inside the container (safe on a live DB,
#    unlike a naive cp), then copy the consistent snapshot out.
docker exec "$APP_CONTAINER" node -e \
  "const d=require('better-sqlite3')(process.env.DATABASE_PATH); d.exec(\"VACUUM INTO '/data/_backup.db'\"); d.close();"
docker cp "$APP_CONTAINER:/data/_backup.db" "$DEST/kittens-$TS.db"
docker exec "$APP_CONTAINER" rm -f /data/_backup.db

# 2) Photos — tar the volume read-only.
docker run --rm -v "$PHOTOS_VOLUME:/photos:ro" -v "$DEST:/backup" alpine \
  tar czf "/backup/photos-$TS.tgz" -C /photos .

# 3) Retention — drop backups older than RETAIN_DAYS days.
find "$DEST" -name 'kittens-*.db' -mtime +"$RETAIN_DAYS" -delete
find "$DEST" -name 'photos-*.tgz' -mtime +"$RETAIN_DAYS" -delete

echo "[$(date -Iseconds)] Backup OK: $DEST/kittens-$TS.db + photos-$TS.tgz"
