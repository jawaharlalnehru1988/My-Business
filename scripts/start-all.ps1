param(
    [switch]$Daemon,
    [switch]$NoBrowser
)

# Microservices Stack 1-Click Orchestrator & Health Checker
$ErrorActionPreference = "Continue"

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

$logDir = Join-Path $rootDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       ACCOUNTING SYSTEM - 1-CLICK STACK LAUNCHER           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Helper to check TCP listening port
function Test-PortListening($port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return ($null -ne $conn)
}

# Helper to poll HTTP endpoint
function Wait-ForHttpEndpoint($url, $timeoutSeconds = 30) {
    $startTime = Get-Date
    while ((Get-Date) -lt $startTime.AddSeconds($timeoutSeconds)) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) { return $true }
        } catch {}
        Start-Sleep -Milliseconds 800
    }
    return $false
}

# 1. Check PostgreSQL
Write-Host "  [1/6] Checking PostgreSQL Database on Port 5432... " -ForegroundColor Yellow -NoNewline
if (Test-PortListening 5432) {
    Write-Host "ONLINE" -ForegroundColor Green
} else {
    Write-Host "OFFLINE" -ForegroundColor Red
    Write-Host "        WARNING: PostgreSQL service on port 5432 is not detected." -ForegroundColor DarkYellow
    Write-Host "        Please ensure PostgreSQL is started so services can connect." -ForegroundColor DarkYellow
}

# 2. Check / Start Eureka Service Registry (8761)
Write-Host "  [2/6] Starting Eureka Service Registry (8761)... " -ForegroundColor Yellow -NoNewline
if (Test-PortListening 8761) {
    Write-Host "ALREADY RUNNING" -ForegroundColor Green
} else {
    Start-Process -FilePath "java" `
        -ArgumentList "-jar", "-Xms64m", "-Xmx128m", "service-registry\target\service-registry-0.0.1-SNAPSHOT.jar" `
        -RedirectStandardOutput "$logDir\service-registry.log" `
        -RedirectStandardError "$logDir\service-registry.err.log" `
        -WindowStyle Hidden
    
    $ready = Wait-ForHttpEndpoint "http://localhost:8761" 35
    if ($ready) {
        Write-Host "READY" -ForegroundColor Green
    } else {
        Write-Host "STARTED (Initializing in background)" -ForegroundColor DarkYellow
    }
}

# 3. Check / Start Auth Service (8085)
Write-Host "  [3/6] Starting Auth Microservice (8085)... " -ForegroundColor Yellow -NoNewline
if (Test-PortListening 8085) {
    Write-Host "ALREADY RUNNING" -ForegroundColor Green
} else {
    Start-Process -FilePath "java" `
        -ArgumentList "-jar", "-Xms64m", "-Xmx128m", "auth-service\target\auth-service-0.0.1-SNAPSHOT.jar" `
        -RedirectStandardOutput "$logDir\auth-service.log" `
        -RedirectStandardError "$logDir\auth-service.err.log" `
        -WindowStyle Hidden
    Write-Host "LAUNCHED" -ForegroundColor Green
}

# 4. Check / Start Inventory Service (8083) & Accounting Service (8081)
Write-Host "  [4/6] Starting Inventory (8083) & Accounting (8081)... " -ForegroundColor Yellow -NoNewline
if (-not (Test-PortListening 8083)) {
    Start-Process -FilePath "java" `
        -ArgumentList "-jar", "-Xms64m", "-Xmx128m", "inventory-service\target\inventory-service-0.0.1-SNAPSHOT.jar" `
        -RedirectStandardOutput "$logDir\inventory-service.log" `
        -RedirectStandardError "$logDir\inventory-service.err.log" `
        -WindowStyle Hidden
}
if (-not (Test-PortListening 8081)) {
    Start-Process -FilePath "java" `
        -ArgumentList "-jar", "-Xms128m", "-Xmx256m", "accounting-service\target\accounting-service-0.0.1-SNAPSHOT.jar" `
        -RedirectStandardOutput "$logDir\accounting-service.log" `
        -RedirectStandardError "$logDir\accounting-service.err.log" `
        -WindowStyle Hidden
}
Write-Host "LAUNCHED" -ForegroundColor Green

# 5. Check / Start Spring Cloud API Gateway (8089)
Write-Host "  [5/6] Starting Spring Cloud API Gateway (8089)... " -ForegroundColor Yellow -NoNewline
if (Test-PortListening 8089) {
    Write-Host "ALREADY RUNNING" -ForegroundColor Green
} else {
    Start-Process -FilePath "java" `
        -ArgumentList "-Dserver.port=8089", "-jar", "-Xms128m", "-Xmx256m", "api-gateway\target\api-gateway-0.0.1-SNAPSHOT.jar" `
        -RedirectStandardOutput "$logDir\api-gateway.log" `
        -RedirectStandardError "$logDir\api-gateway.err.log" `
        -WindowStyle Hidden
    
    $ready = Wait-ForHttpEndpoint "http://localhost:8089/api/v1/version" 35
    if ($ready) {
        Write-Host "READY" -ForegroundColor Green
    } else {
        Write-Host "STARTED (Initializing in background)" -ForegroundColor DarkYellow
    }
}

# 6. Check / Start React Frontend (4200)
Write-Host "  [6/6] Starting React Frontend Web App (4200)... " -ForegroundColor Yellow -NoNewline
if (Test-PortListening 4200) {
    Write-Host "ALREADY RUNNING" -ForegroundColor Green
} else {
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npx vite preview --host 0.0.0.0 --port 4200" `
        -WorkingDirectory (Join-Path $rootDir "react-frontend") `
        -RedirectStandardOutput "$logDir\frontend.log" `
        -RedirectStandardError "$logDir\frontend.err.log" `
        -WindowStyle Hidden
    
    $ready = Wait-ForHttpEndpoint "http://localhost:4200" 15
    if ($ready) {
        Write-Host "READY" -ForegroundColor Green
    } else {
        Write-Host "LAUNCHED" -ForegroundColor Green
    }
}

# Display Final Status
& "$PSScriptRoot\status.ps1"

# Launch Browser if requested
if (-not $NoBrowser) {
    Write-Host "Opening web app in default browser: http://localhost:4200" -ForegroundColor Cyan
    Start-Process "http://localhost:4200"
}

if ($Daemon) {
    Write-Host ""
    Write-Host "Stack running in daemon mode. Monitoring processes..." -ForegroundColor Cyan
    while ($true) {
        Start-Sleep -Seconds 10
    }
}
