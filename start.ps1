# GARBISCAN — start backend + frontend in two windows
$CapstoneRoot = $PSScriptRoot
$RepoRoot = Split-Path $CapstoneRoot -Parent

Write-Host "Starting GARBISCAN (backend + frontend)..." -ForegroundColor Green

# One-time: venv + pip deps
$VenvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "First-time setup: creating venv and installing Python packages..." -ForegroundColor Yellow
    python -m venv (Join-Path $RepoRoot "venv")
    & (Join-Path $RepoRoot "venv\Scripts\pip.exe") install -r (Join-Path $CapstoneRoot "requirements.txt")
}

$FrontendDir = Join-Path $CapstoneRoot "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "First-time setup: npm install..." -ForegroundColor Yellow
    Set-Location $FrontendDir
    npm install
    Set-Location $CapstoneRoot
}

Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $CapstoneRoot "start-backend.ps1")
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $CapstoneRoot "start-frontend.ps1")

Write-Host ""
Write-Host "  Open: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:8000" -ForegroundColor DarkGray
Write-Host ""
