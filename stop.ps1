# Stop GARBISCAN dev servers on ports 3000 and 8000
foreach ($port in 3000, 8000) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-Host "Stopping port $port (PID $($_.OwningProcess))" -ForegroundColor Yellow
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
}
Write-Host "Done." -ForegroundColor Green
