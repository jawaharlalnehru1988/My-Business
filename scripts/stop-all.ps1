# Microservices Stack Graceful Stopper
$targetPorts = @(4200, 4173, 5173, 8089, 8085, 8081, 8083, 8761)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "           STOPPING ACCOUNTING SYSTEM MICROSERVICES         " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($port in $targetPorts) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $pidToStop = $conn.OwningProcess
            try {
                $proc = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  Stopping service on Port $port (PID $pidToStop - $($proc.ProcessName))... " -ForegroundColor Yellow -NoNewline
                    Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
                    Write-Host "DONE" -ForegroundColor Green
                }
            } catch {
                Write-Host "FAILED ($($_.Exception.Message))" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  Port $port is already clear." -ForegroundColor Gray
    }
}

Start-Sleep -Seconds 1
Write-Host ""
Write-Host "All microservices and frontend instances have been stopped." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
