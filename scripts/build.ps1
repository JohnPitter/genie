# build.ps1 — full production build for Genie (Windows PowerShell 7+)
# Usage: ./scripts/build.ps1 [-NoFrontend]
#
# Produces a single binary at ./genie.exe.
# Requires: Go 1.23+, Node 20+, pnpm

[CmdletBinding()]
param (
    [switch]$NoFrontend
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# ── 1. Frontend ───────────────────────────────────────────────────────────────
if (-not $NoFrontend) {
    Write-Host '==> Building frontend' -ForegroundColor Cyan
    Push-Location apps/web
    pnpm install --frozen-lockfile
    pnpm build
    Pop-Location

    Write-Host '==> Copying frontend to embed dir' -ForegroundColor Cyan
    $embedDir = 'apps/api/cmd/genie/webdist'
    Remove-Item -Recurse -Force $embedDir -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path $embedDir | Out-Null
    Copy-Item -Recurse 'apps/web/build/*' $embedDir
    $count = (Get-ChildItem -Recurse $embedDir -File).Count
    Write-Host "    $count files copied" -ForegroundColor DarkGray
} else {
    Write-Host '==> Skipping frontend build (-NoFrontend)' -ForegroundColor DarkGray
}

# ── 2. Go binary ──────────────────────────────────────────────────────────────
Write-Host '==> Building Go binary' -ForegroundColor Cyan
Push-Location apps/api

$version = (git describe --tags --always 2>$null)
if (-not $version) { $version = 'dev' }

$env:GOOS   = if ($env:GOOS)   { $env:GOOS }   else { 'windows' }
$env:GOARCH = if ($env:GOARCH) { $env:GOARCH } else { 'amd64' }

$output = '../../genie.exe'

go build `
    -tags embedweb `
    -ldflags "-s -w -X main.version=$version" `
    -o $output `
    ./cmd/genie

Pop-Location

# ── 3. Report ─────────────────────────────────────────────────────────────────
if (Test-Path './genie.exe') {
    $size = [math]::Round((Get-Item './genie.exe').Length / 1MB, 1)
    Write-Host "==> Done: ./genie.exe (${size} MB)" -ForegroundColor Green
} else {
    Write-Host '==> Done: ./genie.exe' -ForegroundColor Green
}
