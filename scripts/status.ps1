# Microservices Stack Status Checker
$services = @(
    @{ Name = "PostgreSQL Database"; Port = 5432; Url = "localhost:5432" },
    @{ Name = "Eureka Service Registry"; Port = 8761; Url = "http://localhost:8761" },
    @{ Name = "Spring Cloud Gateway"; Port = 8089; Url = "http://localhost:8089" },
    @{ Name = "Auth Service"; Port = 8085; Url = "http://localhost:8085" },
    @{ Name = "Accounting Service"; Port = 8081; Url = "http://localhost:8081" },
    @{ Name = "Inventory Service"; Port = 8083; Url = "http://localhost:8083" },
    @{ Name = "React Web App"; Port = 4200; Url = "http://localhost:4200" }
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         ACCOUNTING SYSTEM - MICROSERVICES STATUS           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$allUp = $true

foreach ($svc in $services) {
    $port = $svc.Port
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($conn) {
        $pidStr = "PID $($conn.OwningProcess)"
        Write-Host "  [ONLINE]  " -ForegroundColor Green -NoNewline
        Write-Host ("{0,-28} Port {1,-5} ({2}) -> {3}" -f $svc.Name, $port, $pidStr, $svc.Url) -ForegroundColor White
    } else {
        $allUp = $false
        Write-Host "  [OFFLINE] " -ForegroundColor Red -NoNewline
        Write-Host ("{0,-28} Port {1,-5} -> {2}" -f $svc.Name, $port, $svc.Url) -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
if ($allUp) {
    Write-Host "  STATUS: ALL SERVICES ARE RUNNING AND HEALTHY!" -ForegroundColor Green
    Write-Host "  Web App: http://localhost:4200" -ForegroundColor Yellow
} else {
    Write-Host "  STATUS: Some services are not running." -ForegroundColor Yellow
    Write-Host "  Run .\start-all.bat to start the entire stack." -ForegroundColor Gray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
