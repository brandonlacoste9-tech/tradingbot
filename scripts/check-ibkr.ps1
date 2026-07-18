# Quick IBKR paper connectivity check against local API.
# Start run-api-ibkr.ps1 first (or any API with BROKER_BACKEND=ibkr).

$Base = if ($env:API_URL) { $env:API_URL.TrimEnd("/") } else { "http://127.0.0.1:8000" }

Write-Host "GET $Base/health"
try {
    $h = Invoke-RestMethod "$Base/health"
    $h | ConvertTo-Json -Compress
} catch {
    Write-Host "API not reachable: $_" -ForegroundColor Red
    Write-Host "Start: .\scripts\run-api-ibkr.ps1"
    exit 1
}

Write-Host "`nGET $Base/broker/status"
try {
    Invoke-RestMethod "$Base/broker/status" | ConvertTo-Json -Depth 6
} catch {
    Write-Host "broker/status failed: $_" -ForegroundColor Yellow
}

Write-Host "`nPOST $Base/connection/validate"
try {
    Invoke-RestMethod -Method Post "$Base/connection/validate" | ConvertTo-Json -Depth 6
    Write-Host "`nOK — paper validate succeeded." -ForegroundColor Green
} catch {
    Write-Host "validate failed: $_" -ForegroundColor Red
    Write-Host "See docs/IBKR_SETUP.md"
    exit 1
}
