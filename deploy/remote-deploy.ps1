# Upload secrets and run vps-deploy.sh on Hostinger VPS
# Usage: .\deploy\remote-deploy.ps1
# Requires: ssh/scp in PATH; root@31.97.136.44 access

$ErrorActionPreference = 'Stop'
$VpsHost = '31.97.136.44'
$VpsUser = 'root'
$SecretsLocal = Join-Path $PSScriptRoot 'env\server.env.production.local'
$SecretsRemote = '/root/phygital-server.env'

& (Join-Path $PSScriptRoot 'prepare-secrets.ps1') | Out-File $SecretsLocal -Encoding utf8

Write-Host "Uploading secrets to ${VpsUser}@${VpsHost}..."
scp $SecretsLocal "${VpsUser}@${VpsHost}:${SecretsRemote}"

Write-Host "Running deploy script on VPS..."
$remote = @'
set -e
if [ -d /var/www/phygital/app/deploy ]; then
  bash /var/www/phygital/app/deploy/vps-deploy.sh --secrets-file /root/phygital-server.env
else
  curl -fsSL https://raw.githubusercontent.com/thankiuday/Phygital_8th_wall/main/deploy/vps-deploy.sh -o /tmp/vps-deploy.sh
  chmod +x /tmp/vps-deploy.sh
  /tmp/vps-deploy.sh --secrets-file /root/phygital-server.env
fi
'@
ssh "${VpsUser}@${VpsHost}" $remote

Write-Host "Done. Open https://phygital.zone"
