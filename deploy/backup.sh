#!/usr/bin/env bash
# Daily CivicFix backup: a PostgreSQL dump (accounts, issues, timeline and photos, which are stored in the
# database). Installed as a cron job by setup-server.sh. Keeps the newest $KEEP_DAYS days in $BACKUP_DIR.
#   sudo /opt/civicfix/deploy/backup.sh
# Restore into a running stack (replaces the current data):
#   cd /opt/civicfix && sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml \
#     exec -T civicfix-db pg_restore -U civicfix -d civicfix --clean --if-exists < /var/backups/civicfix/db-<stamp>.dump
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/civicfix}"
KEEP_DAYS="${KEEP_DAYS:-7}"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.yml" -f "$APP_DIR/deploy/docker-compose.prod.yml")
STAMP="$(date +%Y%m%d-%H%M%S)"

umask 077
mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

OUT="$BACKUP_DIR/db-$STAMP.dump"
"${COMPOSE[@]}" exec -T civicfix-db pg_dump -U civicfix -d civicfix --format=custom > "$OUT.partial"
mv "$OUT.partial" "$OUT"
find "$BACKUP_DIR" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
