# Deploy Phygital to Hostinger VPS

**VPS IP:** `31.97.136.44`  
**Domain:** `https://phygital.zone` (+ `https://ar.phygital.zone`)  
**Repo:** `https://github.com/thankiuday/Phygital_8th_wall.git`

## DNS (one-time)

| Type | Name | Value |
|------|------|-------|
| A | `@` | `31.97.136.44` |
| A | `www` | `31.97.136.44` |
| A | `ar` | `31.97.136.44` |

If `phygital.zone` already points to the VPS, you only need to add the **`ar`** record.

## Deploy steps

### 1. Hostinger snapshot + SSH

Create a VPS snapshot, then: `ssh root@31.97.136.44`

### 2. Upload secrets (from your PC)

```powershell
cd c:\NeardsAndGeeks\PhygitalEightThWall
.\deploy\prepare-secrets.ps1 | Out-File deploy\env\server.env.production.local -Encoding utf8
scp deploy\env\server.env.production.local root@31.97.136.44:/root/phygital-server.env
```

### 3. Run on VPS

```bash
curl -fsSL https://raw.githubusercontent.com/thankiuday/Phygital_8th_wall/main/deploy/vps-deploy.sh -o /tmp/vps-deploy.sh
chmod +x /tmp/vps-deploy.sh
/tmp/vps-deploy.sh --secrets-file /root/phygital-server.env
```

Or copy the script from a fresh clone if GitHub is not updated yet:

```bash
cd /var/www/phygital && git clone https://github.com/thankiuday/Phygital_8th_wall.git app
bash /var/www/phygital/app/deploy/vps-deploy.sh --secrets-file /root/phygital-server.env --no-remove-old
```

## Google OAuth

Add authorized redirect URI in Google Cloud Console:

`https://phygital.zone/api/auth/google/callback`

## Updates

```bash
cd /var/www/phygital/app
git fetch origin && git reset --hard origin/main
npm install
npm run build:client && npm run build:ar
pm2 restart phygital-api
pm2 restart phygital-render-worker 2>/dev/null || true
nginx -t && systemctl reload nginx
```

### Card PNG export (“Generate & download”) troubleshooting

If print download fails in production:

1. **Chromium** (required for Puppeteer):

```bash
apt-get update
apt-get install -y chromium-browser fonts-liberation libgbm1 libnss3 libatk-bridge2.0-0
# confirm path:
which chromium || which chromium-browser
```

2. **server `.env`** must include:

```bash
CLIENT_URL=https://phygital.zone
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium   # or chromium-browser
```

3. **Render worker** (when `REDIS_URL` is set):

```bash
pm2 start deploy/pm2.ecosystem.config.cjs --only phygital-render-worker
pm2 logs phygital-render-worker --lines 50
```

4. **API logs** for direct-render errors:

```bash
pm2 logs phygital-api --lines 80
```
