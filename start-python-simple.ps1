# Simple Python Startup Script
# This script starts the Python Face Recognition Service
# Author: System Administrator
# Version: 1.0

param(
    [switch]$SkipDependencies,
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions for better output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" "Yellow"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Cyan"
}

# Service configuration
$PythonPath = "C:\Face_recogn_attendancev2-main\python"
$PythonPort = 8001

# Function to check if port is available
function Test-Port {
    param([int]$Port)
    try {
        $connection = New-Object System.Net.Sockets.TcpClient
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Function to setup Python virtual environment
function Setup-PythonEnvironment {
    Write-Info "Setting up Python virtual environment..."
    
    if (-not (Test-Path $PythonPath)) {
        Write-Error "Python directory not found: $PythonPath"
        return $false
    }
    
    Push-Location $PythonPath
    try {
        # Create virtual environment if it doesn't exist
        if (-not (Test-Path "venv")) {
            Write-Info "Creating Python virtual environment..."
            python -m venv venv
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to create virtual environment"
            }
            Write-Success "Virtual environment created"
        }
        
        # Activate virtual environment
        Write-Info "Activating virtual environment..."
        & ".\venv\Scripts\Activate.ps1"
        
        # Upgrade pip
        Write-Info "Upgrading pip..."
        python -m pip install --upgrade pip
        
        # Install requirements
        Write-Info "Installing Python dependencies..."
        pip install -r requirements.txt
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install Python dependencies"
        }
        Write-Success "Python dependencies installed successfully"
        return $true
    }
    catch {
        Write-Error "Failed to setup Python environment: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

# Main function
function Main {
    try {
        Write-ColorOutput "Face Recognition Python Service - Simple Startup" "Magenta"
        Write-ColorOutput "===============================================" "Magenta"
        Write-ColorOutput ""
        
        # Setup Python environment if not skipped
        if (-not $SkipDependencies) {
            $envSetup = Setup-PythonEnvironment
            if (-not $envSetup) {
                Write-Error "Python environment setup failed. Please check the error messages above."
                exit 1
            }
            Write-ColorOutput ""
        }
        
        # Check if Python directory exists
        if (-not (Test-Path $PythonPath)) {
            Write-Error "Python directory not found: $PythonPath"
            exit 1
        }
        
        # Check if virtual environment exists
        $venvPath = "$PythonPath\venv\Scripts\python.exe"
        if (-not (Test-Path $venvPath)) {
            Write-Error "Python virtual environment not found at: $venvPath"
            Write-Error "Please run without -SkipDependencies to create the virtual environment"
            exit 1
        }
        
        # Check if port is already in use
        if (Test-Port -Port $PythonPort) {
            Write-Warning "Port $PythonPort is already in use. Python service may already be running."
            Write-Info "Python Face Recognition: https://localhost:$PythonPort"
            Write-Info "Press Ctrl+C to exit this script"
            try {
                while ($true) {
                    Start-Sleep -Seconds 1
                }
            }
            catch [System.Management.Automation.PipelineStoppedException] {
                Write-Info "Exiting..."
            }
            return
        }
        
        # Start Python service
        Write-Info "Starting Python Face Recognition Service..."
        Write-Info "Python Path: $PythonPath"
        Write-Info "Python Port: $PythonPort"
        Write-ColorOutput ""
        
        Push-Location $PythonPath
        try {
            Write-Info "Changing to Python directory..."
            Write-Info "Activating virtual environment..."
            Write-Info "Running: python .\recognizer_service.py"
            Write-ColorOutput ""
            
            # Activate virtual environment and run the service
            & ".\venv\Scripts\Activate.ps1"
            python .\recognizer_service.py
            
        }
        catch {
            Write-Error "Failed to start Python service: $($_.Exception.Message)"
            exit 1
        }
        finally {
            Pop-Location
        }
    }
    catch {
        Write-Error "An error occurred: $($_.Exception.Message)"
        exit 1
    }
}

# Script parameters help
if ($args -contains "--help" -or $args -contains "-h") {
    Write-ColorOutput "Simple Python Startup Script" "Magenta"
    Write-ColorOutput "Usage: .\start-python-simple.ps1 [options]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Options:" "Yellow"
    Write-ColorOutput "  -SkipDependencies    Skip Python environment setup" "White"
    Write-ColorOutput "  -Verbose             Enable verbose output" "White"
    Write-ColorOutput "  -h, --help          Show this help message" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Yellow"
    Write-ColorOutput "  .\start-python-simple.ps1                    # Start Python service with full setup" "White"
    Write-ColorOutput "  .\start-python-simple.ps1 -SkipDependencies  # Skip environment setup" "White"
    exit 0
}

# Run main function
Main


