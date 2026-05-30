# GARBISCAN — Next.js dashboard (port 3000)
$ErrorActionPreference = "Stop"
$FrontendDir = Join-Path $PSScriptRoot "frontend"

Set-Location $FrontendDir

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "  GARBISCAN Frontend  ->  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Command Center tab  ->  live YOLO video feed" -ForegroundColor DarkGray
Write-Host ""

npm run dev
