#requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path $PSScriptRoot).Path

function Write-Info {
  param([string]$Message)
  Write-Host $Message
}

function Prompt-YesNo {
  param([string]$Message)
  $response = Read-Host "$Message [y/N]"
  return $response -match '^(y|yes)$'
}

function Command-Exists {
  param([string]$Name)
  return (Get-Command $Name -ErrorAction SilentlyContinue) -ne $null
}

$needSetup = $false

if (-not (Command-Exists "node") -or -not (Command-Exists "npm")) {
  $needSetup = $true
}

if (-not (Test-Path (Join-Path $Root ".venv\Scripts\python.exe"))) {
  $needSetup = $true
}

if (-not (Test-Path (Join-Path $Root "web-app\node_modules")) -or
    -not (Test-Path (Join-Path $Root "web-app\server\node_modules")) -or
    -not (Test-Path (Join-Path $Root "web-app\client\node_modules"))) {
  $needSetup = $true
}

if (-not (Test-Path (Join-Path $Root "web-app\server\.env"))) {
  $needSetup = $true
}

if ($needSetup) {
  Write-Info "Setup not complete."
  if (Prompt-YesNo "Run .\setup.ps1 now?") {
    & (Join-Path $Root "setup.ps1")
  } else {
    Write-Info "Run .\setup.ps1 first, then re-run .\run.ps1."
    exit 1
  }
}

Write-Info "Starting servers..."
Push-Location $Root
npm run dev
Pop-Location
