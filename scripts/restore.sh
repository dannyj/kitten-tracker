#!/usr/bin/env bash
# Restore a backup into the kitten-app volumes. Stops the app, replaces the DB
# and photos, restarts. Run from the compose directory on the Docker host:
#   scripts/restore.sh ~/kitten-backups/kittens-YYYYMMDD-HHMMSS.db ~/kitten-backups/photos-YYYYMMDD-HHMMSS.tgz
set -euo pipefail

DB_BACKUP="${1:?usage: restore.sh <kittens-*.db> <photos-*.tgz>}"
PHOTOS_BACKUP="${2:?usage: restore.sh <kittens-*.db> <photos-*.tgz>}"
APP_CONTAINER="${APP_CONTAINER:-kitten-app}"
DB_VOLUME="${DB_VOLUME:-kitten_app_kitten-db}"
PHOTOS_VOLUME="${PHOTOS_VOLUME:-kitten_app_kitten-photos}"

DB_DIR="$(cd "$(dirname "$DB_BACKUP")" && pwd)"
PH_DIR="$(cd "$(dirname "$PHOTOS_BACKUP")" && pwd)"
DB_FILE="$(basename "$DB_BACKUP")"
PH_FILE="$(basename "$PHOTOS_BACKUP")"

echo "Stopping app…"
docker stop "$APP_CONTAINER" >/dev/null

echo "Restoring database…"
docker run --rm -v "$DB_VOLUME:/data" -v "$DB_DIR:/in:ro" alpine sh -c \
  "rm -f /data/kittens.db /data/kittens.db-wal /data/kittens.db-shm && cp /in/$DB_FILE /data/kittens.db"

echo "Restoring photos…"
docker run --rm -v "$PHOTOS_VOLUME:/photos" -v "$PH_DIR:/in:ro" alpine sh -c \
  "rm -rf /photos/* && tar xzf /in/$PH_FILE -C /photos"

echo "Starting app…"
docker start "$APP_CONTAINER" >/dev/null
echo "Restore complete. Verify at the app URL."
