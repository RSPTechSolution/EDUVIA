# Starts the whole EDUVIA development stack on Windows:
#   Docker Desktop -> Postgres + Redis -> API (:8000) -> web (:3000) -> Flutter parent app (:8090, if built)
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1 [-Build]
#   -Build   rebuild the web app first (needed after pulling new code)
param([switch]$Build)
# Native tools (docker, alembic) write progress to stderr, which PowerShell 5.1 would treat as fatal;
# check results explicitly instead.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot

function Wait-Url($url, $seconds = 60) {
  for ($i = 0; $i -lt $seconds; $i++) {
    try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep -Seconds 1 }
  }
  return $false
}

Write-Host "1/5 Docker" -ForegroundColor Cyan
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 3; docker info 2>&1 | Out-Null; if ($LASTEXITCODE -eq 0) { break } }
}

Write-Host "2/5 Postgres + Redis" -ForegroundColor Cyan
docker compose -f "$root\infra\compose\docker-compose.dev.yml" up -d | Out-Null
Start-Sleep -Seconds 4
Push-Location "$root\api"
& .\venv\Scripts\alembic.exe upgrade head
Pop-Location

# Free the ports, then start each server hidden in the background.
foreach ($p in 8000, 3000, 8090) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}

Write-Host "3/5 API on http://localhost:8000" -ForegroundColor Cyan
Start-Process -FilePath "$root\api\venv\Scripts\uvicorn.exe" -WorkingDirectory "$root\api" -WindowStyle Hidden `
  -ArgumentList "app.main:app", "--reload", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=127.0.0.1"
if (-not (Wait-Url "http://localhost:8000/api/v1/health" 300)) { throw "The API did not start. Run it in a terminal to see the error." }

Write-Host "4/5 Web on http://localhost:3000" -ForegroundColor Cyan
$env:NEXT_DIST_DIR = ".next-prod"
if ($Build -or -not (Test-Path "$root\web\.next-prod\BUILD_ID")) {
  Push-Location "$root\web"; npm run build; Pop-Location
}
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" -WorkingDirectory "$root\web" -WindowStyle Hidden
Wait-Url "http://localhost:3000/login" | Out-Null

Write-Host "5/5 Flutter parent app" -ForegroundColor Cyan
if (Test-Path "$root\mobile\build\web\index.html") {
  Start-Process -FilePath "$root\api\venv\Scripts\python.exe" -ArgumentList "-m", "http.server", "8090" `
    -WorkingDirectory "$root\mobile\build\web" -WindowStyle Hidden
  Write-Host "   http://localhost:8090"
} else {
  Write-Host "   not built (cd mobile; flutter build web --dart-define=FLAVOR=parent)"
}
Write-Host "Ready. Sign in at http://localhost:3000 with school ID 'demo', admin@demo.com / Demo@1234" -ForegroundColor Green
