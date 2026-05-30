# GARBISCAN — one-time install (run once)
$ErrorActionPreference = "Stop"
$CapstoneRoot = $PSScriptRoot
$RepoRoot = Split-Path $CapstoneRoot -Parent

Write-Host "=== GARBISCAN Setup ===" -ForegroundColor Green

# Python
$VenvDir = Join-Path $RepoRoot "venv"
if (-not (Test-Path $VenvDir)) {
    Write-Host "[1/3] Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv $VenvDir
}
$Pip = Join-Path $VenvDir "Scripts\pip.exe"
Write-Host "[2/3] Installing Python dependencies..." -ForegroundColor Yellow
& $Pip install --upgrade pip
& $Pip install -r (Join-Path $CapstoneRoot "requirements.txt")

# Node
$FrontendDir = Join-Path $CapstoneRoot "frontend"
Write-Host "[3/3] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location $FrontendDir
npm install

# Data folder
New-Item -ItemType Directory -Force -Path (Join-Path $CapstoneRoot "data") | Out-Null

Write-Host ""
Write-Host "Setup complete. Run:" -ForegroundColor Green
Write-Host "  .\start.ps1" -ForegroundColor Cyan
Write-Host ""
