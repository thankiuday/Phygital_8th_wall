#!/usr/bin/env bash
# Run on VPS if deploy stopped at "Vite requires Node.js version 20.19+"
set -euo pipefail
APP_ROOT="${APP_ROOT:-/var/www/phygital/app}"
SECRETS_FILE="${SECRETS_FILE:-/root/phygital-server.env}"

echo "=== Upgrade Node to 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
hash -r
node -v
npm -v

echo "=== Reinstall deps on Node 20 (fixes rolldown native binding) ==="
cd "$APP_ROOT"
rm -rf node_modules client/node_modules server/node_modules ar-engine/node_modules
rm -f package-lock.json
npm install

echo "=== Build and start app ==="
cp "$SECRETS_FILE" server/.env
grep -q '^REDIS_URL=' server/.env || echo 'REDIS_URL=redis://127.0.0.1:6379' >> server/.env
cp deploy/env/client.env.production client/.env.production
cp deploy/env/ar-engine.env.production ar-engine/.env.production

npm run build:client
npm run build:ar

pm2 delete phygital-backend phygital-api phygital-scan-worker phygital-render-worker 2>/dev/null || true
pm2 start deploy/pm2.ecosystem.config.cjs --only phygital-api
grep -q '^REDIS_URL=' server/.env && pm2 start deploy/pm2.ecosystem.config.cjs --only phygital-scan-worker,phygital-render-worker 2>/dev/null || true
pm2 save

CERT_DIR="/etc/letsencrypt/live/phygital.zone"
NGINX_AVAILABLE="/etc/nginx/sites-available/phygital.zone"
if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  cp deploy/nginx/phygital.zone.conf "$NGINX_AVAILABLE"
else
  cp deploy/nginx/phygital.zone-http.conf "$NGINX_AVAILABLE"
fi
ln -sf "$NGINX_AVAILABLE" /etc/nginx/sites-enabled/phygital.zone
rm -f /etc/nginx/sites-enabled/phygital 2>/dev/null || true
nginx -t && systemctl reload nginx

echo "=== Done ==="
pm2 list
echo "Open https://phygital.zone"
