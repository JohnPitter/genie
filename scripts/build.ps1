# build.ps1 — full production build for Genie (Windows PowerShell 7+)
# Usage: ./scripts/build.ps1 [-ApiOnly] [-WebOnly]
#
# Builds the TypeScript API (tsup → dist/) and the SvelteKit frontend (build/).
# Requires: Node 22+, pnpm

[CmdletBinding()]
param (
    [switch]$ApiOnly,
    [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# ── 1. Frontend ───────────────────────────────────────────────────────────────
if (-not $ApiOnly) {
    Write-Host '==> Building frontend (SvelteKit)' -ForegroundColor Cyan
    Push-Location apps/web
    pnpm build
    Pop-Location
    Write-Host '    Output: apps/web/build/' -ForegroundColor DarkGray
}

# ── 2. API ────────────────────────────────────────────────────────────────────
if (-not $WebOnly) {
    Write-Host '==> Building API (tsup)' -ForegroundColor Cyan
    Push-Location apps/api
    pnpm build
    Pop-Location
    Write-Host '    Output: apps/api/dist/' -ForegroundColor DarkGray
}

Write-Host '==> Done' -ForegroundColor Green
