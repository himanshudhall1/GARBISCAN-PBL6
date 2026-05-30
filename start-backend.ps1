# GARBISCAN — FastAPI + YOLO backend (port 8000)
$ErrorActionPreference = "Stop"
$CapstoneRoot = $PSScriptRoot
$RepoRoot = Split-Path $CapstoneRoot -Parent
$VenvActivate = Join-Path $RepoRoot "venv\Scripts\Activate.ps1"
$BackendDir = Join-Path $CapstoneRoot "backend"

if (-not (Test-Path $VenvActivate)) {
    Write-Host "Creating Python venv at $RepoRoot\venv ..." -ForegroundColor Yellow
    python -m venv (Join-Path $RepoRoot "venv")
}

Set-Location $BackendDir
& $VenvActivate

Write-Host ""
Write-Host "  GARBISCAN Backend  ->  http://localhost:8000" -ForegroundColor Green
Write-Host "  API docs           ->  http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host "  CSV logs           ->  capstone\data\live_metrics.csv" -ForegroundColor DarkGray
Write-Host ""

$env:INFERENCE_DELAY_SEC = if ($env:INFERENCE_DELAY_SEC) { $env:INFERENCE_DELAY_SEC } else { "0.45" }
$env:FRAME_SKIP = if ($env:FRAME_SKIP) { $env:FRAME_SKIP } else { "4" }

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
