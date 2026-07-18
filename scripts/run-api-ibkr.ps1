# Run FastAPI against local IB Gateway paper (port 4002).
# Prerequisite: IB Gateway running in Paper mode with API enabled.
# See docs/IBKR_SETUP.md

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Root "apps\api"

Set-Location $Api

if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    python -m venv .venv
}

.\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
pip install -q ib_async

$env:BROKER_BACKEND = "ibkr"
$env:IBKR_HOST = if ($env:IBKR_HOST) { $env:IBKR_HOST } else { "127.0.0.1" }
$env:IBKR_PORT = if ($env:IBKR_PORT) { $env:IBKR_PORT } else { "4002" }
$env:IBKR_CLIENT_ID = if ($env:IBKR_CLIENT_ID) { $env:IBKR_CLIENT_ID } else { "1" }
$env:PAPER_ONLY = "true"

Write-Host "BROKER_BACKEND=$env:BROKER_BACKEND  IBKR=$env:IBKR_HOST`:$env:IBKR_PORT  clientId=$env:IBKR_CLIENT_ID"
Write-Host "Ensure IB Gateway Paper is running, then open http://localhost:8000/docs"
Write-Host "UI: set NEXT_PUBLIC_API_URL=http://localhost:8000 and npm run dev in apps/web"
Write-Host ""

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
