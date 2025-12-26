# Simple Frontend Startup Script
# This script starts the Frontend Development Server using npm run dev
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
$FrontendPath = "C:\Face_recogn_attendancev2-main\frontend"
$FrontendPort = 5173

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

# Function to install dependencies
function Install-Dependencies {
    Write-Info "Installing frontend dependencies..."
    
    if (-not (Test-Path $FrontendPath)) {
        Write-Error "Frontend directory not found: $FrontendPath"
        return $false
    }
    
    Push-Location $FrontendPath
    try {
        if (-not (Test-Path "node_modules")) {
            Write-Info "Installing npm packages..."
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install frontend dependencies"
            }
            Write-Success "Frontend dependencies installed successfully"
        } else {
            Write-Success "Frontend dependencies already installed"
        }
        return $true
    }
    catch {
        Write-Error "Failed to install frontend dependencies: $($_.Exception.Message)"
        return $false
    }
    finally {
        Pop-Location
    }
}

# Main function
function Main {
    try {
        Write-ColorOutput "Face Recognition Frontend - Simple Startup" "Magenta"
        Write-ColorOutput "==========================================" "Magenta"
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
        
        # Check if frontend directory exists
        if (-not (Test-Path $FrontendPath)) {
            Write-Error "Frontend directory not found: $FrontendPath"
            exit 1
        }
        
        # Check if port is already in use
        if (Test-Port -Port $FrontendPort) {
            Write-Warning "Port $FrontendPort is already in use. Frontend may already be running."
            Write-Info "Frontend (React App): https://localhost:$FrontendPort"
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
        
        # Start frontend service
        Write-Info "Starting Frontend Development Server..."
        Write-Info "Frontend Path: $FrontendPath"
        Write-Info "Frontend Port: $FrontendPort"
        Write-ColorOutput ""
        
        Push-Location $FrontendPath
        try {
            Write-Info "Changing to Frontend directory..."
            Write-Info "Running: npm run dev"
            Write-ColorOutput ""
            
            # Start the frontend service
            npm run dev
            
        }
        catch {
            Write-Error "Failed to start frontend service: $($_.Exception.Message)"
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
    Write-ColorOutput "Simple Frontend Startup Script" "Magenta"
    Write-ColorOutput "Usage: .\start-frontend-simple.ps1 [options]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Options:" "Yellow"
    Write-ColorOutput "  -SkipDependencies    Skip dependency installation" "White"
    Write-ColorOutput "  -Verbose             Enable verbose output" "White"
    Write-ColorOutput "  -h, --help          Show this help message" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Yellow"
    Write-ColorOutput "  .\start-frontend-simple.ps1                    # Start frontend with full setup" "White"
    Write-ColorOutput "  .\start-frontend-simple.ps1 -SkipDependencies  # Skip dependency installation" "White"
    exit 0
}

# Run main function
Main


