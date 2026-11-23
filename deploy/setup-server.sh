#!/usr/bin/env bash
# Install or update CivicFix on a server whose ports 80/443 are already served by Medical Claim AI's Caddy
# (https://github.com/santhosh12133/medical-claim-ai). CivicFix publishes no ports: Caddy reaches it over the
# shared Docker network "caddy-shared" and loads its site file from the shared sites folder.
# Safe to re-run: it updates the code and keeps secrets, data and accounts. It never touches the other app's
# containers, data or files, except adding/replacing its own site file and asking Caddy to reload.
#
#   curl -fsSL https://raw.githubusercontent.com/santhosh12133/CivicGuardAI/main/deploy/setup-server.sh \
#     | sudo bash -s -- --admin-email you@example.com
#
# Options:
#   --admin-email EMAIL   create an admin account for the portal with a random password, saved (not printed)
#                         to /root/civicfix-credentials.txt. An existing account is left unchanged.
#   --admin-name NAME     its display name (default "Administrator")
#   --domain auto|NAME    auto (default): civicfix.<ip-with-dashes>.sslip.io; NAME: your own domain
#                         (point its DNS A record at this server first)
#   --name LABEL          first label of the auto address (default civicfix)
#   --public-ip ADDR      use ADDR instead of the detected public IP
#   --site-address ADDR   exact Caddy site address, e.g. http://civicfix.localhost (testing)
#   --edge-project NAME   Docker Compose project that owns Caddy (default medical-claim-ai)
#   --app-dir DIR         install directory (default /opt/civicfix)
#   --branch NAME         git branch (default main)
#   --repo URL            git repository
#   --no-update           use the code already in --app-dir as it is (no git pull)
#   --no-backups          do not install the daily database backup job
#   --min-free-mb N       refuse to build when less than N MB of memory is available (default 700)
set -euo pipefail

REPO_URL="https://github.com/santhosh12133/CivicGuardAI.git"
BRANCH="main"
APP_DIR="/opt/civicfix"
DOMAIN="auto"
NAME_LABEL="civicfix"
PUBLIC_IP_OVERRIDE=""
SITE_ADDRESS=""
EDGE_PROJECT="medical-claim-ai"
ADMIN_EMAIL=""
ADMIN_NAME="Administrator"
UPDATE=1
BACKUPS=1
MIN_FREE_MB=700
CREDENTIALS_FILE="/root/civicfix-credentials.txt"
SITE_FILE_NAME="civicfix.caddy"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWARNING: %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --admin-email) ADMIN_EMAIL="${2:?}"; shift 2 ;;
    --admin-name) ADMIN_NAME="${2:?}"; shift 2 ;;
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --name) NAME_LABEL="${2:?}"; shift 2 ;;
    --public-ip) PUBLIC_IP_OVERRIDE="${2:?}"; shift 2 ;;
    --site-address) SITE_ADDRESS="${2:?}"; shift 2 ;;
    --edge-project) EDGE_PROJECT="${2:?}"; shift 2 ;;
    --app-dir) APP_DIR="${2:?}"; shift 2 ;;
    --branch) BRANCH="${2:?}"; shift 2 ;;
    --repo) REPO_URL="${2:?}"; shift 2 ;;
    --no-update) UPDATE=0; shift ;;
    --no-backups) BACKUPS=0; shift ;;
    --min-free-mb) MIN_FREE_MB="${2:?}"; shift 2 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash setup-server.sh ..."
[[ "$NAME_LABEL" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || die "--name must be lower-case letters, digits and dashes"

# ----------------------------------------------------------------------------- server
log "Checking the server"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
AVAIL_MB=$(awk '/MemAvailable/ {m=$2} /SwapFree/ {s=$2} END {print int((m+s)/1024)}' /proc/meminfo)
echo "$(. /etc/os-release && echo "$PRETTY_NAME"), $(uname -m), $(nproc) CPU, ${MEM_MB} MB RAM, ${AVAIL_MB} MB available (RAM + swap)"
[ "$AVAIL_MB" -ge "$MIN_FREE_MB" ] \
  || die "Only ${AVAIL_MB} MB of memory available; CivicFix needs about ${MIN_FREE_MB} MB to build and run beside the other app. Nothing was changed."

command -v docker >/dev/null 2>&1 || die "Docker is not installed. This script adds CivicFix to a server that already runs Medical Claim AI."
command -v git >/dev/null 2>&1 || die "git is not installed (apt-get install -y git)"
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null | sed 's/^v//') || die "Docker Compose plugin missing"
printf '2.24.4\n%s\n' "$COMPOSE_VERSION" | sort -V -C || die "Docker Compose $COMPOSE_VERSION is too old (need 2.24.4+)"

# ----------------------------------------------------------------------------- shared Caddy
log "Checking the shared web server (Caddy of project '$EDGE_PROJECT')"
CADDY=$(docker ps -q --filter "label=com.docker.compose.project=$EDGE_PROJECT" --filter label=com.docker.compose.service=caddy | head -1)
UPDATE_EDGE="Update Medical Claim AI first (it adds the shared network and sites folder):
  sudo bash /opt/medical-claim-ai/deploy/setup-server.sh"
[ -n "$CADDY" ] || die "No running Caddy container found for project '$EDGE_PROJECT'. $UPDATE_EDGE"
docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CADDY" | grep -qw caddy-shared \
  || die "Caddy is not on the 'caddy-shared' network. $UPDATE_EDGE"
SITES_DIR=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/sites"}}{{.Source}}{{end}}{{end}}' "$CADDY")
[ -n "$SITES_DIR" ] && [ -d "$SITES_DIR" ] || die "Caddy has no sites folder mounted at /etc/caddy/sites. $UPDATE_EDGE"
docker exec "$CADDY" grep -q '^import /etc/caddy/sites/' /etc/caddy/Caddyfile \
  || die "Caddy's Caddyfile does not import /etc/caddy/sites. $UPDATE_EDGE"
EDGE_SITE=$(docker exec "$CADDY" printenv SITE_ADDRESS 2>/dev/null || true)
echo "Caddy: OK (sites folder $SITES_DIR; other site: ${EDGE_SITE:-unknown})"

caddy_validate() { docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; }
caddy_validate || die "Caddy's current configuration is already invalid; fix that before adding a site. Nothing was changed."

# ----------------------------------------------------------------------------- code
if [ -d "$APP_DIR/.git" ]; then
  if [ "$UPDATE" -eq 1 ]; then
    log "Updating the code in $APP_DIR ($BRANCH)"
    git -C "$APP_DIR" fetch -q origin "$BRANCH"
    git -C "$APP_DIR" checkout -q "$BRANCH"
    git -C "$APP_DIR" pull -q --ff-only origin "$BRANCH"
  fi
elif [ -e "$APP_DIR/docker-compose.yml" ]; then
  log "Using the existing code in $APP_DIR"
else
  log "Downloading the code into $APP_DIR"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml)

# ----------------------------------------------------------------------------- address
if [ -z "$SITE_ADDRESS" ]; then
  if [ "$DOMAIN" = "auto" ]; then
    PUBLIC_IP="$PUBLIC_IP_OVERRIDE"
    [ -n "$PUBLIC_IP" ] || PUBLIC_IP=$(curl -fsS4 --max-time 6 https://api.ipify.org 2>/dev/null || curl -fsS4 --max-time 6 https://ifconfig.me 2>/dev/null || true)
    [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Could not detect the public IP; pass --public-ip ADDR or --domain NAME"
    SITE_ADDRESS="$NAME_LABEL.${PUBLIC_IP//./-}.sslip.io"
  else
    SITE_ADDRESS="$DOMAIN"
  fi
fi
case "$SITE_ADDRESS" in
  http://*) HOST="${SITE_ADDRESS#http://}"; ORIGIN="$SITE_ADDRESS"; SCHEME=http ;;
  https://*) HOST="${SITE_ADDRESS#https://}"; ORIGIN="$SITE_ADDRESS"; SCHEME=https ;;
  *) HOST="$SITE_ADDRESS"; ORIGIN="https://$SITE_ADDRESS"; SCHEME=https ;;
esac
HOST="${HOST%%/*}"
[[ "$HOST" =~ ^[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || die "Invalid address: $SITE_ADDRESS"
[ "$SITE_ADDRESS" != "${EDGE_SITE:-}" ] || die "$SITE_ADDRESS is already the other app's address; choose another --name"
echo "Public address: $ORIGIN"

# ----------------------------------------------------------------------------- configuration
set_env() {  # set_env KEY VALUE: replace or append, keeping every other line of .env
  local key="$1" value="$2" tmp
  if grep -q "^${key}=" .env; then
    tmp=$(mktemp)
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' .env > "$tmp"
    cat "$tmp" > .env && rm -f "$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}
env_value() { sed -n "s/^$1=//p" .env | tail -1; }

umask 077
if [ ! -f .env ]; then
  log "Creating .env with new random secrets (root-only)"
  cp deploy/env.example .env
else
  log "Keeping the existing .env (secrets unchanged)"
fi
chown root:root .env && chmod 600 .env
[ -n "$(env_value POSTGRES_PASSWORD)" ] || set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
[ -n "$(env_value JWT_SECRET)" ] || set_env JWT_SECRET "$(openssl rand -hex 32)"
set_env SITE_ADDRESS "$SITE_ADDRESS"
set_env CORS_ORIGINS "$ORIGIN"
set_env API_HOST "$HOST"
set_env API_PROTOCOL "$SCHEME"
set_env PUBLIC_API_URL "$ORIGIN"
set_env ADMIN_URL "$ORIGIN"
set_env VITE_API_URL "$ORIGIN/api"
umask 022

# ----------------------------------------------------------------------------- start
log "Building and starting CivicFix (the first build takes 5-10 minutes on 1 CPU)"
"${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout 900 \
  || {
    "${COMPOSE[@]}" logs --tail 60
    "${COMPOSE[@]}" ps -a --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'
    die "CivicFix did not become healthy (the other app is unaffected). Re-run once; if it fails again, send the table above."
  }
# The portal is built for one public address: always recreate it so a changed address takes effect.
"${COMPOSE[@]}" up -d --no-deps --force-recreate --wait --wait-timeout 120 civicfix-admin
"${COMPOSE[@]}" ps

# ----------------------------------------------------------------------------- route through Caddy
log "Adding $HOST to the shared web server"
SITE_FILE="$SITES_DIR/$SITE_FILE_NAME"
BACKUP_FILE="$SITES_DIR/.$SITE_FILE_NAME.previous"
[ ! -f "$SITE_FILE" ] || cp -p "$SITE_FILE" "$BACKUP_FILE"
TMP_SITE=$(mktemp)
cat > "$TMP_SITE" <<EOF
# CivicFix: written by $APP_DIR/deploy/setup-server.sh. Edits here are replaced on the next run.
$SITE_ADDRESS {
	encode zstd gzip

	request_body {
		max_size 12MB
	}

	@api path /api/* /uploads/* /health
	handle @api {
		reverse_proxy civicfix-api:5000
	}

	handle {
		reverse_proxy civicfix-admin:80
	}

	header {
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		-Server
	}

	log {
		output stdout
		format console
	}
}
EOF
chmod 644 "$TMP_SITE" && mv "$TMP_SITE" "$SITE_FILE"
if ! caddy_validate; then
  if [ -f "$BACKUP_FILE" ]; then mv "$BACKUP_FILE" "$SITE_FILE"; else rm -f "$SITE_FILE"; fi
  docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -5 || true
  die "Caddy rejected the CivicFix site; the previous configuration was restored and is still running."
fi
docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  || die "Caddy could not reload. It keeps serving its previous configuration. Check: docker logs $CADDY"
rm -f "$BACKUP_FILE"
echo "Site file: $SITE_FILE"

# ----------------------------------------------------------------------------- admin account
if [ -n "$ADMIN_EMAIL" ]; then
  log "Admin account"
  ADMIN_EMAIL=$(printf '%s' "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]')
  EMAIL_RE='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  [[ "$ADMIN_EMAIL" =~ $EMAIL_RE ]] || die "Invalid --admin-email"
  EXISTS=$("${COMPOSE[@]}" exec -T civicfix-db psql -U civicfix -d civicfix -tAc \
    "SELECT count(*) FROM users WHERE lower(email) = '$ADMIN_EMAIL'")
  if [ "${EXISTS//[^0-9]/}" != "0" ]; then
    echo "$ADMIN_EMAIL already exists; password unchanged"
  else
    API_CONTAINER=$("${COMPOSE[@]}" ps -q civicfix-api)
    STAFF_PASSWORD=$(openssl rand -hex 12)
    STAFF_PASSWORD="$STAFF_PASSWORD" docker exec -e STAFF_PASSWORD "$API_CONTAINER" \
      node scripts/create-staff-user.js --email "$ADMIN_EMAIL" --name "$ADMIN_NAME" --role admin >/dev/null
    umask 077
    printf '%s  admin  %s  password: %s\n' "$(date -u +%FT%TZ)" "$ADMIN_EMAIL" "$STAFF_PASSWORD" >> "$CREDENTIALS_FILE"
    umask 022
    unset STAFF_PASSWORD
    echo "Created $ADMIN_EMAIL; its password is in $CREDENTIALS_FILE (root only)"
  fi
fi

# ----------------------------------------------------------------------------- backups
if [ "$BACKUPS" -eq 1 ]; then
  log "Installing the daily backup job (03:10, keeps 7 days in /var/backups/civicfix)"
  printf 'SHELL=/bin/bash\n10 3 * * * root APP_DIR=%s %s/deploy/backup.sh >> /var/log/civicfix-backup.log 2>&1\n' \
    "$APP_DIR" "$APP_DIR" > /etc/cron.d/civicfix
  chmod 644 /etc/cron.d/civicfix
fi

# ----------------------------------------------------------------------------- verify
log "Checking $ORIGIN through the web server"
if [ "$SCHEME" = https ]; then
  PORT=443; [[ "$HOST" == *:* ]] && PORT="${HOST##*:}"
  probe() { curl -fsS --max-time 10 --resolve "${HOST%%:*}:$PORT:127.0.0.1" "$ORIGIN$1"; }
else
  probe() { curl -fsS --max-time 10 -H "Host: $HOST" "http://127.0.0.1$1"; }
fi
OK=0
for _ in $(seq 1 30); do   # the first HTTPS certificate can take a minute
  HEALTH=$(probe /health 2>/dev/null || true)
  if [[ "$HEALTH" == *'"database":"ok"'* ]]; then OK=1; break; fi
  sleep 4
done
if [ "$OK" -eq 1 ]; then
  echo "API:           OK ($ORIGIN/health)"
  if probe /api/auth/providers >/dev/null 2>&1; then echo "Sign-in API:   OK"; else warn "Sign-in API did not answer"; fi
  PAGE=$(probe / 2>/dev/null || true)
  if [[ "$PAGE" == *'<title>CivicFix Admin</title>'* ]]; then echo "Admin portal:  OK"; else warn "Admin portal did not answer"; fi
else
  warn "CivicFix did not answer through Caddy yet. For HTTPS this usually means the certificate could not be
  issued yet; check: docker logs --tail 50 $CADDY"
fi
if [ -n "${EDGE_SITE:-}" ] && [[ "$EDGE_SITE" != :* ]]; then
  if curl -fsS --max-time 10 --resolve "$EDGE_SITE:443:127.0.0.1" "https://$EDGE_SITE/api/health/ready" >/dev/null 2>&1; then
    echo "Other app:     OK (https://$EDGE_SITE)"
  else
    warn "The other app (https://$EDGE_SITE) did not answer its health check; check it before continuing"
  fi
fi
[ "$OK" -eq 1 ] || exit 1

cat <<EOF

------------------------------------------------------------------
 CivicFix is running.

 Admin portal:     $ORIGIN
 API:              $ORIGIN/api   (health: $ORIGIN/health)
 Android app:      server address $ORIGIN
 Admin password:   $( [ -f "$CREDENTIALS_FILE" ] && echo "sudo cat $CREDENTIALS_FILE" || echo "create an admin: re-run with --admin-email you@example.com" )
 Update:           re-run this script (keeps data, secrets and accounts)
 Logs:             cd $APP_DIR && sudo ${COMPOSE[*]} logs -f
 Backups:          $( [ "$BACKUPS" -eq 1 ] && echo "daily to /var/backups/civicfix" || echo "not installed" )
------------------------------------------------------------------
EOF
