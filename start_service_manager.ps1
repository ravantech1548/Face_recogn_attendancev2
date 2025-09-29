# Face Recognition System Service Manager
# This script can be run from anywhere in the project folder

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Face Recognition System Service Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to find the python directory
function Find-PythonDir {
    param([string]$StartPath)
    
    $possiblePaths = @(
        "$StartPath\python",
        "$StartPath\..\python",
        "$StartPath\..\..\python"
    )
    
    foreach ($path in $possiblePaths) {
        $resolvedPath = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolvedPath -and (Test-Path "$resolvedPath\service_manager.py")) {
            return $resolvedPath.Path
        }
    }
    return $null
}

# Find the python directory
$PythonDir = Find-PythonDir -StartPath $ScriptDir

if (-not $PythonDir) {
    Write-Host "Error: Could not find service_manager.py" -ForegroundColor Red
    Write-Host "Please run this script from the project folder or a subdirectory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found service manager at: $PythonDir" -ForegroundColor Green
Write-Host ""

# Change to the python directory
Set-Location $PythonDir

# Check if virtual environment exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & ".\venv\Scripts\Activate.ps1"
} else {
    Write-Host "Warning: Virtual environment not found at $PythonDir\venv" -ForegroundColor Yellow
    Write-Host "Make sure Python dependencies are installed" -ForegroundColor Yellow
}

# Check if service_manager.py exists
if (-not (Test-Path "service_manager.py")) {
    Write-Host "Error: service_manager.py not found in $PythonDir" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting Service Manager..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Run the service manager with all arguments passed through
try {
    python service_manager.py $args
} catch {
    Write-Host "Error running service manager: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Service Manager has stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
