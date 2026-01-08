#requires -Version 5.1
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path "$PSScriptRoot\..").Path

function Write-Info {
  param([string]$Message)
  Write-Host $Message
}

function Command-Exists {
  param([string]$Name)
  return (Get-Command $Name -ErrorAction SilentlyContinue) -ne $null
}

function Prompt-YesNo {
  param([string]$Message)
  $response = Read-Host "$Message [y/N]"
  return $response -match '^(y|yes)$'
}

function Get-PythonCommand {
  if (Command-Exists "python") { return @("python") }
  if (Command-Exists "py") { return @("py", "-3") }
  return $null
}

function Get-PythonMinorVersion {
  param([string[]]$PythonCmd)
  return & $PythonCmd -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
}

function Python-VersionOk {
  param([string[]]$PythonCmd)
  $version = Get-PythonMinorVersion -PythonCmd $PythonCmd
  return [version]$version -ge [version]"3.10"
}

function Get-NodeMajorVersion {
  $version = (node -v).TrimStart('v')
  return [int]($version.Split('.')[0])
}

function Node-VersionOk {
  $major = Get-NodeMajorVersion
  return $major -ge 18
}

function Venv-Ok {
  return Test-Path (Join-Path $Root ".venv\\Scripts\\python.exe")
}

function NodeModules-Ok {
  return (Test-Path (Join-Path $Root "web-app\\node_modules")) `
    -and (Test-Path (Join-Path $Root "web-app\\server\\node_modules")) `
    -and (Test-Path (Join-Path $Root "web-app\\client\\node_modules"))
}

function Env-Ok {
  return Test-Path (Join-Path $Root "web-app\\server\\.env")
}

function Preflight-Ok {
  $pythonCmd = Get-PythonCommand
  $pythonOk = $false
  if ($pythonCmd) {
    $pythonOk = Python-VersionOk -PythonCmd $pythonCmd
  }

  $nodeOk = $false
  if (Command-Exists "node") {
    $nodeOk = Node-VersionOk
  }

  return $pythonOk -and $nodeOk -and (Command-Exists "npm") -and (Venv-Ok) -and (NodeModules-Ok) -and (Env-Ok)
}

function Install-WithWinget {
  param(
    [string]$Id,
    [string]$Label
  )

  if (-not (Command-Exists "winget")) {
    Write-Info "winget not found. Install $Label manually."
    return $false
  }

  if (-not (Prompt-YesNo "Install $Label via winget?")) {
    return $false
  }

  & winget install -e --id $Id
  if ($LASTEXITCODE -ne 0) {
    Write-Info "Failed to install $Label via winget. Install it manually."
    return $false
  }

  return $true
}

function Ensure-Python {
  $pythonCmd = Get-PythonCommand
  if ($pythonCmd) {
    if (Python-VersionOk -PythonCmd $pythonCmd) {
      Write-Info "Python found: $(& $pythonCmd --version)"
      return $pythonCmd
    }
    Write-Info "Python 3.10+ required, found: $(& $pythonCmd --version)"
  } else {
    Write-Info "Python not found."
  }

  Install-WithWinget -Id "Python.Python.3.12" -Label "Python 3"
  $pythonCmd = Get-PythonCommand

  if (-not $pythonCmd) {
    Write-Info "Python 3.10+ is required. Install it and re-run this script."
    exit 1
  }

  if (-not (Python-VersionOk -PythonCmd $pythonCmd)) {
    Write-Info "Python 3.10+ is required. Upgrade Python and re-run."
    exit 1
  }

  return $pythonCmd
}

function Ensure-Node {
  if (Command-Exists "node") {
    if (Node-VersionOk) {
      Write-Info "Node found: $(node -v)"
      return
    }
    Write-Info "Node 18+ required, found: $(node -v)"
  } else {
    Write-Info "Node not found."
  }

  Install-WithWinget -Id "OpenJS.NodeJS.LTS" -Label "Node.js"

  if (-not (Command-Exists "node")) {
    Write-Info "Node.js 18+ is required. Install it and re-run this script."
    exit 1
  }

  if (-not (Node-VersionOk)) {
    Write-Info "Node.js 18+ is required. Upgrade Node.js and re-run."
    exit 1
  }

  if (-not (Command-Exists "npm")) {
    Write-Info "npm not found. Install npm and re-run."
    exit 1
  }
}

function Ensure-OptionalDeps {
  $missing = @()
  if (-not (Command-Exists "soffice")) { $missing += "LibreOffice" }
  if (-not (Command-Exists "pdftoppm")) { $missing += "Poppler" }

  if ($missing.Count -eq 0) {
    Write-Info "Optional screenshot dependencies are installed."
    return
  }

  Write-Info "Optional screenshot dependencies missing: $($missing -join ', ')"

  if ($missing -contains "LibreOffice") {
    Install-WithWinget -Id "TheDocumentFoundation.LibreOffice" -Label "LibreOffice"
  }
  if ($missing -contains "Poppler") {
    Install-WithWinget -Id "Poppler.Poppler" -Label "Poppler"
  }
}

function Install-PythonDeps {
  $venvDir = Join-Path $Root ".venv"
  if (Test-Path $venvDir) {
    Write-Info "Using existing virtual environment: $venvDir"
  } else {
    Write-Info "Creating virtual environment: $venvDir"
    & $pythonCmd -m venv $venvDir
  }

  $venvPython = Join-Path $venvDir "Scripts\python.exe"
  & $venvPython -m pip install --upgrade pip
  & $venvPython -m pip install -r (Join-Path $Root "requirements.txt")
}

function Install-NodeDeps {
  Write-Info "Installing web app dependencies..."
  Push-Location (Join-Path $Root "web-app")
  npm install
  Pop-Location

  Push-Location (Join-Path $Root "web-app\server")
  npm install
  Pop-Location

  Push-Location (Join-Path $Root "web-app\client")
  npm install
  Pop-Location
}

function Ensure-EnvFile {
  $envFile = Join-Path $Root "web-app\server\.env"
  $envExample = Join-Path $Root "web-app\server\.env.example"

  if (Test-Path $envFile) {
    Write-Info "Found existing .env at web-app/server/.env"
    return
  }

  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Info "Created web-app/server/.env from .env.example"
  } else {
    Write-Info "No .env example found. Create web-app/server/.env manually if needed."
  }
}

Write-Info "PPT to Learning setup"
Write-Info "Root: $Root"

$optionalChecked = $false
if (Preflight-Ok) {
  Write-Info "Everything you need is already installed."
  Ensure-OptionalDeps
  $optionalChecked = $true
  if (-not (Prompt-YesNo "Reinstall/update dependencies anyway?")) {
    Write-Info "Setup complete."
    Write-Info "Next: .\\run.ps1 (or npm run dev)"
    Write-Info "Backend: http://localhost:3001 | Frontend: http://localhost:5173"
    Write-Info "Add GEMINI_API_KEY in web-app/server/.env or in the app Settings modal."
    exit 0
  }
}

$pythonCmd = Ensure-Python
Ensure-Node
if (-not $optionalChecked) {
  Ensure-OptionalDeps
}
Install-PythonDeps
Install-NodeDeps
Ensure-EnvFile

Write-Info "Setup complete."
Write-Info "Next: .\\run.ps1 (or npm run dev)"
Write-Info "Backend: http://localhost:3001 | Frontend: http://localhost:5173"
Write-Info "Add GEMINI_API_KEY in web-app/server/.env or in the app Settings modal."
