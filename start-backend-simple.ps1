# Simple Backend Startup Script
# This script starts the Backend API Server using npm start
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
$BackendPath = "C:\Face_recogn_attendancev2-main\backend"
$BackendPort = 5000

# Function to install dependencies
function Install-Dependencies {
    Write-Info "Installing backend dependencies..."
    
    if (-not (Test-Path $BackendPath)) {
        Write-Error "Backend directory not found: $BackendPath"
        return $false
    }
    
    Push-Location $BackendPath
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Info "Installing npm packages..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install backend dependencies"
            }
            Write-Success "Backend dependencies installed successfully"
        } else {
            Write-Success "Backend dependencies already installed"
        }
        return $true
    }
    catch {
        Write-Error "Failed to install backend dependencies: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

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

# Main function
function Main {
    try {
        Write-ColorOutput "Face Recognition Backend - Simple Startup" "Magenta"
        Write-ColorOutput "=========================================" "Magenta"
        Write-ColorOutput ""
        
        # Install dependencies if not skipped
        if (-not $SkipDependencies) {
            $depsInstalled = Install-Dependencies
            if (-not $depsInstalled) {
                Write-Error "Dependency installation failed. Please check the error messages above."
                exit 1
            }
            Write-ColorOutput ""
        }
        
        # Check if backend directory exists
        if (-not (Test-Path $BackendPath)) {
            Write-Error "Backend directory not found: $BackendPath"
            exit 1
        }
        
        # Check if port is already in use
        if (Test-Port -Port $BackendPort) {
            Write-Warning "Port $BackendPort is already in use. Backend may already be running."
            Write-Info "Backend API: https://localhost:$BackendPort"
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
        
        # Start backend service
        Write-Info "Starting Backend API Server..."
        Write-Info "Backend Path: $BackendPath"
        Write-Info "Backend Port: $BackendPort"
        Write-ColorOutput ""
        
        Push-Location $BackendPath
        try {
            Write-Info "Running: npm start"
            Write-ColorOutput ""
            
            # Start the backend service
            npm start
            
        }
        catch {
            Write-Error "Failed to start backend service: $($_.Exception.Message)"
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
    Write-ColorOutput "Simple Backend Startup Script" "Magenta"
    Write-ColorOutput "Usage: .\start-backend-simple.ps1 [options]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Options:" "Yellow"
    Write-ColorOutput "  -SkipDependencies    Skip dependency installation" "White"
    Write-ColorOutput "  -Verbose             Enable verbose output" "White"
    Write-ColorOutput "  -h, --help          Show this help message" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Yellow"
    Write-ColorOutput "  .\start-backend-simple.ps1                    # Start backend with full setup" "White"
    Write-ColorOutput "  .\start-backend-simple.ps1 -SkipDependencies  # Skip dependency installation" "White"
    exit 0
}

# Run main function
Main


