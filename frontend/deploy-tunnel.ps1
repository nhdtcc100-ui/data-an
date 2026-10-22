#!/usr/bin/env pwsh
# ============================================================
# deploy-tunnel.ps1
# 1. Starts a Cloudflare Tunnel pointing at local Supabase (port 8000)
# 2. Waits for the tunnel URL
# 3. Builds the frontend with that URL injected
# 4. Deploys to GitHub Pages (gh-pages branch)
# ============================================================

$ErrorActionPreference = 'Stop'

# ── Config ─────────────────────────────────────────────────────────────────────
$SUPABASE_PORT    = 8000
$FRONTEND_DIR     = "$PSScriptRoot\frontend"
$ANON_KEY         = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyNjY0NzY1LCJleHAiOjE5NTAzNDQ3NjV9.7HBWC-YC_7L400M5lDIEEVod0BKyUNRKGyveE6_Zdzw"
$TUNNEL_LOG       = "$env:TEMP\cloudflared-tunnel.log"

Write-Host "`n🚀 Starting Cloudflare Tunnel → localhost:$SUPABASE_PORT`n" -ForegroundColor Cyan

# ── Check cloudflared is installed ─────────────────────────────────────────────
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "⬇️  cloudflared not found. Installing via winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared -e --silent
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
}

# ── Kill any leftover tunnel process ───────────────────────────────────────────
Stop-Process -Name cloudflared -ErrorAction SilentlyContinue

# ── Start tunnel in background, capture URL from logs ─────────────────────────
Write-Host "🌐 Opening tunnel..." -ForegroundColor Cyan
$tunnelJob = Start-Process -FilePath cloudflared `
    -ArgumentList "tunnel --url http://localhost:$SUPABASE_PORT" `
    -RedirectStandardError $TUNNEL_LOG `
    -PassThru -WindowStyle Hidden

# Wait up to 30 s for the trycloudflare URL to appear
$tunnelUrl = $null
$waited = 0
while ($waited -lt 30) {
    Start-Sleep -Seconds 1
    $waited++
    if (Test-Path $TUNNEL_LOG) {
        $content = Get-Content $TUNNEL_LOG -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Error "Cannot detect Cloudflare tunnel URL after 30 seconds. Check $TUNNEL_LOG"
    exit 1
}

Write-Host "✅ Tunnel URL: $tunnelUrl" -ForegroundColor Green

# ── Write .env.production with the tunnel URL ──────────────────────────────────
$envContent = "VITE_SUPABASE_URL=$tunnelUrl`nVITE_SUPABASE_ANON_KEY=$ANON_KEY"
Set-Content -Path "$FRONTEND_DIR\.env.production" -Value $envContent -Encoding UTF8
Write-Host "📝 Written .env.production" -ForegroundColor Cyan

# ── Build the frontend ─────────────────────────────────────────────────────────
Write-Host "🔨 Building frontend..." -ForegroundColor Cyan
Push-Location $FRONTEND_DIR
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }
Pop-Location

Write-Host "✅ Build complete!" -ForegroundColor Green

# ── Deploy to GitHub Pages ─────────────────────────────────────────────────────
Write-Host "📤 Deploying to GitHub Pages..." -ForegroundColor Cyan
Push-Location (Split-Path $FRONTEND_DIR)
npx --yes gh-pages -d frontend/dist --dotfiles
if ($LASTEXITCODE -ne 0) { Write-Error "Deploy failed"; exit 1 }
Pop-Location

Write-Host "
╔══════════════════════════════════════════════════════════╗
║  ✅  Deploy complete!                                    ║
╠══════════════════════════════════════════════════════════╣
║  App: https://nhdtcc100-ui.github.io/data-an/            ║
║  DB Tunnel: $tunnelUrl
║                                                          ║
║  Keep this window open to maintain the tunnel!           ║
║  Press Ctrl+C to stop.                                   ║
╚══════════════════════════════════════════════════════════╝
" -ForegroundColor Green

Wait-Process -Id $tunnelJob.Id
