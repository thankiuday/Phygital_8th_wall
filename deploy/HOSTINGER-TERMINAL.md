# Hostinger browser terminal — deploy Phygital to phygital.zone

Run these as **root** in: Hostinger VPS → **Terminal** (or `ssh root@31.97.136.44`).

## 0. Snapshot

In Hostinger panel: **Snapshots → Create snapshot** (recommended before replacing the old site).

## 1. DNS (Hostinger → Domains → phygital.zone → DNS)

Ensure these exist:

| Type | Name | Points to |
|------|------|-----------|
| A | `@` | `31.97.136.44` |
| A | `www` | `31.97.136.44` |
| A | `ar` | `31.97.136.44` |

## 2. Create secrets on the VPS

On your **Windows PC** (PowerShell), generate production env (do not commit this file):

```powershell
cd c:\NeardsAndGeeks\PhygitalEightThWall
.\deploy\prepare-secrets.ps1 | Out-File deploy\env\server.env.production.local -Encoding utf8
notepad deploy\env\server.env.production.local
```

Copy **all** lines from Notepad.

On the **VPS terminal**:

```bash
nano /root/phygital-server.env
```

Paste, save (`Ctrl+O`, Enter, `Ctrl+X`).

## 3. Run full deploy (removes old site, installs stack, builds, PM2, nginx, SSL)

```bash
curl -fsSL https://raw.githubusercontent.com/thankiuday/Phygital_8th_wall/main/deploy/vps-deploy.sh -o /tmp/vps-deploy.sh
chmod +x /tmp/vps-deploy.sh
/tmp/vps-deploy.sh --secrets-file /root/phygital-server.env
```

Takes ~10–15 minutes (npm install + builds).

## 4. Verify on the VPS

```bash
pm2 list
pm2 logs phygital-api --lines 30
curl -sI https://phygital.zone | head -5
curl -s https://phygital.zone/api/public/campaigns/000000000000000000000000 2>/dev/null | head -c 200
```

- Homepage should show the **Phygital AR dashboard app**, not the old “Phygital Zone” marketing page.
- API should return **JSON** (e.g. 404 message), not HTML.

## 5. Google OAuth (browser)

In Google Cloud Console → OAuth client → **Authorized redirect URIs**, add:

`https://phygital.zone/api/auth/google/callback`

Remove old `localhost` redirect for production if you no longer need it.

## 6. Test in browser

- https://phygital.zone — login / dashboard
- https://ar.phygital.zone/ar/YOUR_PUBLISHED_CAMPAIGN_ID — AR (mobile + HTTPS)

## Troubleshooting

```bash
# Re-run deploy after git updates
cd /var/www/phygital/app && git pull && npm install
npm run build:client && npm run build:ar
pm2 restart phygital-api
nginx -t && systemctl reload nginx

# Logs
pm2 logs phygital-api
tail -f /var/log/nginx/error.log
```
