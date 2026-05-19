#!/usr/bin/env bash
# Phygital — one-shot VPS deploy (Ubuntu 22.04, Hostinger)
# Run as root on the VPS:
#   curl -fsSL https://raw.githubusercontent.com/thankiuday/Phygital_8th_wall/main/deploy/vps-deploy.sh -o /tmp/vps-deploy.sh
#   chmod +x /tmp/vps-deploy.sh
#   /tmp/vps-deploy.sh --secrets-file /root/phygital-server.env

set -euo pipefail

DOMAIN="${DOMAIN:-phygital.zone}"
AR_DOMAIN="ar.${DOMAIN}"
REPO_URL="${REPO_URL:-https://github.com/thankiuday/Phygital_8th_wall.git}"
APP_ROOT="${APP_ROOT:-/var/www/phygital/app}"
SECRETS_FILE="${SECRETS_FILE:-/root/phygital-server.env}"
REMOVE_OLD="${REMOVE_OLD:-1}"
INSTALL_REDIS="${INSTALL_REDIS:-1}"
SKIP_SSL="${SKIP_SSL:-0}"
NGINX_SITE="phygital.zone"

usage() {
  sed -n '2,8p' "$0"
  echo ""
  echo "Options:"
  echo "  --secrets-file PATH   server .env source (default: /root/phygital-server.env)"
  echo "  --domain NAME         apex domain (default: phygital.zone)"
  echo "  --no-remove-old       keep existing /var/www projects and pm2 apps"
  echo "  --no-redis            skip redis-server install"
  echo "  --skip-ssl            skip certbot"
  echo "  --audit-only          print inventory and exit"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --secrets-file) SECRETS_FILE="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; AR_DOMAIN="ar.${DOMAIN}"; shift 2 ;;
    --no-remove-old) REMOVE_OLD=0; shift ;;
    --no-redis) INSTALL_REDIS=0; shift ;;
    --skip-ssl) SKIP_SSL=1; shift ;;
    --audit-only) AUDIT_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

log() { echo "[phygital-deploy] $*"; }

audit() {
  log "=== VPS audit ==="
  command -v node && node -v || echo "node: not installed"
  command -v nginx && nginx -v 2>&1 || echo "nginx: not installed"
  command -v pm2 && pm2 -v || echo "pm2: not installed"
  pm2 list 2>/dev/null || true
  systemctl is-active nginx 2>/dev/null || true
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
  ls -la /var/www/ 2>/dev/null || true
  certbot certificates 2>/dev/null || true
}

if [[ "${AUDIT_ONLY:-0}" == "1" ]]; then
  audit
  exit 0
fi

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "ERROR: secrets file not found: $SECRETS_FILE"
  exit 1
fi

log "=== Step 0: audit ==="
audit

log "=== Step 1: remove old app (nginx/certbot kept) ==="
if [[ "$REMOVE_OLD" == "1" ]]; then
  pm2 delete all 2>/dev/null || true
  find /var/www -mindepth 1 -maxdepth 1 ! -name certbot -exec rm -rf {} + 2>/dev/null || true
fi

log "=== Step 2: install prerequisites ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Vite 8 / client require Node 20+ (Node 18 on the VPS is not enough)
NODE_MAJOR=0
if command -v node >/dev/null; then
  NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
fi
if ! command -v node >/dev/null || [[ "$NODE_MAJOR" -lt 20 ]]; then
  log "Installing Node.js 20 (current: $(node -v 2>/dev/null || echo none))"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  hash -r
  log "Node after upgrade: $(node -v)"
fi

apt-get install -y git nginx curl

if ! command -v pm2 >/dev/null; then
  npm install -g pm2
fi

if [[ "$INSTALL_REDIS" == "1" ]]; then
  apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi

mkdir -p /var/log/phygital /var/www/certbot "$(dirname "$APP_ROOT")"
ufw allow OpenSSH 2>/dev/null || true
ufw allow 'Nginx Full' 2>/dev/null || true
ufw --force enable 2>/dev/null || true

log "=== Step 3: clone and install ==="
if [[ -d "$APP_ROOT/.git" ]]; then
  cd "$APP_ROOT"
  git fetch origin
  git reset --hard origin/main
else
  git clone "$REPO_URL" "$APP_ROOT"
  cd "$APP_ROOT"
fi

npm install

cp "$SECRETS_FILE" "$APP_ROOT/server/.env"
if [[ "$INSTALL_REDIS" == "1" ]] && ! grep -q '^REDIS_URL=' "$APP_ROOT/server/.env" 2>/dev/null; then
  echo "REDIS_URL=redis://127.0.0.1:6379" >> "$APP_ROOT/server/.env"
fi

cp deploy/env/client.env.production "$APP_ROOT/client/.env.production"
cp deploy/env/ar-engine.env.production "$APP_ROOT/ar-engine/.env.production"

npm run build:client
npm run build:ar

log "=== Step 4: PM2 ==="
cd "$APP_ROOT"
pm2 delete phygital-api phygital-scan-worker phygital-render-worker 2>/dev/null || true
pm2 start deploy/pm2.ecosystem.config.cjs --only phygital-api

if grep -q '^REDIS_URL=' "$APP_ROOT/server/.env" 2>/dev/null; then
  pm2 start deploy/pm2.ecosystem.config.cjs --only phygital-scan-worker,phygital-render-worker 2>/dev/null || \
    log "Workers skipped (optional: apt install chromium-browser for render worker)"
fi

pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true

log "=== Step 5: nginx ==="
for f in /etc/nginx/sites-enabled/*; do
  [[ -e "$f" ]] || continue
  base=$(basename "$f")
  if [[ "$base" != "$NGINX_SITE" ]]; then
    rm -f "$f"
  fi
done

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"

if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  cp "$APP_ROOT/deploy/nginx/phygital.zone.conf" "$NGINX_AVAILABLE"
else
  cp "$APP_ROOT/deploy/nginx/phygital.zone-http.conf" "$NGINX_AVAILABLE"
fi
ln -sf "$NGINX_AVAILABLE" "/etc/nginx/sites-enabled/${NGINX_SITE}"

nginx -t
systemctl enable nginx
systemctl reload nginx

if [[ "$SKIP_SSL" != "1" ]]; then
  apt-get install -y certbot python3-certbot-nginx 2>/dev/null || true
  if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -d "$AR_DOMAIN" \
      --non-interactive --agree-tos --register-unsafely-without-email || \
      log "certbot failed — add DNS A record: ar -> this server IP"
    if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
      cp "$APP_ROOT/deploy/nginx/phygital.zone.conf" "$NGINX_AVAILABLE"
      nginx -t && systemctl reload nginx
    fi
  else
    cp "$APP_ROOT/deploy/nginx/phygital.zone.conf" "$NGINX_AVAILABLE"
    nginx -t && systemctl reload nginx
  fi
fi

log "=== Deploy complete ==="
log "Site:  https://${DOMAIN}"
log "AR:    https://${AR_DOMAIN}"
log "API:   https://${DOMAIN}/api"
log "Google OAuth: https://${DOMAIN}/api/auth/google/callback"
