# Build /root/phygital-server.env content from local server/.env (production URLs)
# Usage: .\deploy\prepare-secrets.ps1 | Set-Content -Encoding utf8 deploy\env\server.env.production.local
# Upload to VPS: scp deploy\env\server.env.production.local root@31.97.136.44:/root/phygital-server.env

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root 'server\.env'
if (-not (Test-Path $envPath)) { throw "Missing $envPath" }

$domain = 'phygital.zone'
$lines = Get-Content $envPath

$overrides = @{
  'NODE_ENV' = 'production'
  'PORT' = '5000'
  'CLIENT_URL' = "https://$domain"
  'API_PUBLIC_URL' = "https://$domain"
  'GOOGLE_REDIRECT_URI' = "https://$domain/api/auth/google/callback"
}

$seen = @{}
$out = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
  if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
  if ($line -notmatch '^([^=]+)=(.*)$') { continue }
  $key = $Matches[1].Trim()
  if ($key -in @('RENDER_EXTERNAL_URL')) { continue }
  if ($overrides.ContainsKey($key)) { continue }
  $seen[$key] = $true
  $out.Add($line)
}

foreach ($kv in $overrides.GetEnumerator()) {
  $out.Add("$($kv.Key)=$($kv.Value)")
}

$out -join "`n"
