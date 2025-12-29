# Face Recognition Attendance System - Service Stop Script
# This script stops all running services
# Author: System Administrator
# Version: 1.0

param(
    [switch]$Force,
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

# Service ports to check
$ServicePorts = @(5000, 8001, 5173)
$ServiceNames = @{
    5000 = "Backend API Server"
    8001 = "Python Face Recognition Service"
    5173 = "Frontend Development Server"
}

# Function to find processes using specific ports
function Get-ProcessesByPort {
    param([int]$Port)
    
    try {
        $connections = netstat -ano | Select-String ":$Port "
        $processes = @()
        
        foreach ($connection in $connections) {
            $parts = $connection.ToString().Split() | Where-Object { $_ -ne "" }
            if ($parts.Length -ge 5) {
                $pid = $parts[-1]
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        $processes += $process
                    }
                }
                catch {
                    # Process might have exited
                }
            }
        }
        
        return $processes
    }
    catch {
        return @()
    }
}

# Function to stop processes gracefully
function Stop-ServiceProcesses {
    param(
        [int]$Port,
        [string]$ServiceName
    )
    
    Write-Info "Stopping $ServiceName on port $Port..."
    
    $processes = Get-ProcessesByPort -Port $Port
    
    if ($processes.Count -eq 0) {
        Write-Info "No processes found on port $Port"
        return $true
    }
    
    $stoppedCount = 0
    foreach ($process in $processes) {
        try {
            Write-Info "Stopping process: $($process.ProcessName) (PID: $($process.Id))"
            
            if ($Force) {
                $process.Kill()
                Write-Success "Force killed process $($process.Id)"
            } else {
                $process.CloseMainWindow()
                if (-not $process.WaitForExit(5000)) {
                    Write-Warning "Process $($process.Id) did not stop gracefully, force killing..."
                    $process.Kill()
                }
                Write-Success "Stopped process $($process.Id)"
            }
            
            $stoppedCount++
        }
        catch {
            Write-Error "Failed to stop process $($process.Id): $($_.Exception.Message)"
        }
    }
    
    if ($stoppedCount -gt 0) {
        Write-Success "Stopped $stoppedCount process(es) for $ServiceName"
    }
    
    return $true
}

# Function to stop all Node.js processes (for backend and frontend)
function Stop-NodeProcesses {
    Write-Info "Stopping all Node.js processes..."
    
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($nodeProcesses.Count -eq 0) {
        Write-Info "No Node.js processes found"
        return $true
    }
    
    $stoppedCount = 0
    foreach ($process in $nodeProcesses) {
        try {
            Write-Info "Stopping Node.js process: PID $($process.Id)"
            
            # Always force kill Node.js processes for reliability
            $process.Kill()
            Write-Success "Force killed Node.js process $($process.Id)"
            $stoppedCount++
        }
        catch {
            Write-Error "Failed to stop Node.js process $($process.Id): $($_.Exception.Message)"
        }
    }
    
    if ($stoppedCount -gt 0) {
        Write-Success "Stopped $stoppedCount Node.js process(es)"
        
        # Wait a moment for processes to fully terminate
        Start-Sleep -Seconds 2
        
        # Double-check that all Node.js processes are gone
        $remainingProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($remainingProcesses.Count -gt 0) {
            Write-Warning "Some Node.js processes may still be running"
            foreach ($process in $remainingProcesses) {
                Write-Info "Remaining Node.js process: PID $($process.Id)"
            }
        }
    }
    
    return $true
}

# Function to stop all Python processes
function Stop-PythonProcesses {
    Write-Info "Stopping all Python processes..."
    
    $pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue
    
    if ($pythonProcesses.Count -eq 0) {
        Write-Info "No Python processes found"
        return $true
    }
    
    $stoppedCount = 0
    foreach ($process in $pythonProcesses) {
        try {
            Write-Info "Stopping Python process: PID $($process.Id)"
            
            # Always force kill Python processes for reliability
            $process.Kill()
            Write-Success "Force killed Python process $($process.Id)"
            $stoppedCount++
        }
        catch {
            Write-Error "Failed to stop Python process $($process.Id): $($_.Exception.Message)"
        }
    }
    
    if ($stoppedCount -gt 0) {
        Write-Success "Stopped $stoppedCount Python process(es)"
        
        # Wait a moment for processes to fully terminate
        Start-Sleep -Seconds 2
        
        # Double-check that all Python processes are gone
        $remainingProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue
        if ($remainingProcesses.Count -gt 0) {
            Write-Warning "Some Python processes may still be running"
            foreach ($process in $remainingProcesses) {
                Write-Info "Remaining Python process: PID $($process.Id)"
            }
        }
    }
    
    return $true
}

# Function to verify all services are stopped
function Test-AllServicesStopped {
    Write-Info "Verifying all services are stopped..."
    
    $allStopped = $true
    
    foreach ($port in $ServicePorts) {
        $serviceName = $ServiceNames[$port]
        $processes = Get-ProcessesByPort -Port $port
        
        if ($processes.Count -eq 0) {
            Write-Success "$serviceName is stopped (port $port)"
        } else {
            Write-Warning "$serviceName still has processes running on port $port"
            $allStopped = $false
        }
    }
    
    return $allStopped
}

# Main execution
function Main {
    Write-ColorOutput "STOP - Face Recognition Attendance System - Service Stop Script" "Magenta"
    Write-ColorOutput "=========================================================" "Magenta"
    Write-ColorOutput "Stopping all services: Backend, Python Face Recognition, Frontend" "White"
    Write-ColorOutput ""
    
    try {
        # Stop services by port
        Write-ColorOutput "SEARCH - Stopping Services by Port..." "Yellow"
        Write-ColorOutput "===============================" "Yellow"
        
        foreach ($port in $ServicePorts) {
            $serviceName = $ServiceNames[$port]
            Stop-ServiceProcesses -Port $port -ServiceName $serviceName
        }
        
        # Stop remaining Node.js processes
        Write-ColorOutput "`nSEARCH - Stopping Remaining Node.js Processes..." "Yellow"
        Write-ColorOutput "=============================================" "Yellow"
        Stop-NodeProcesses
        
        # Stop remaining Python processes
        Write-ColorOutput "`nSEARCH - Stopping Remaining Python Processes..." "Yellow"
        Write-ColorOutput "===========================================" "Yellow"
        Stop-PythonProcesses
        
        # Additional cleanup - kill any remaining processes on our ports
        Write-ColorOutput "`nCLEANUP - Final Cleanup..." "Yellow"
        Write-ColorOutput "=========================" "Yellow"
        foreach ($port in $ServicePorts) {
            $serviceName = $ServiceNames[$port]
            $processes = Get-ProcessesByPort -Port $port
            if ($processes.Count -gt 0) {
                Write-Warning "Found remaining processes on port $port for $serviceName"
                foreach ($process in $processes) {
                    try {
                        Write-Info "Force killing remaining process: $($process.ProcessName) (PID: $($process.Id))"
                        $process.Kill()
                        Write-Success "Killed process $($process.Id)"
                    }
                    catch {
                        Write-Error "Failed to kill process $($process.Id): $($_.Exception.Message)"
                    }
                }
            }
        }
        
        # Verify all services are stopped
        Write-ColorOutput "`nSEARCH - Verifying Services are Stopped..." "Yellow"
        Write-ColorOutput "=====================================" "Yellow"
        
        if (Test-AllServicesStopped) {
            Write-Success "All services have been stopped successfully!"
        } else {
            Write-Warning "Some services may still be running"
        }
        
        # Summary
        Write-ColorOutput "`nSUMMARY - Stop Summary:" "Green"
        Write-ColorOutput "================" "Green"
        Write-Success "All Face Recognition Attendance System services have been stopped"
        
        if ($Force) {
            Write-Info "Services were force stopped"
        } else {
            Write-Info "Services were stopped gracefully"
        }
        
    }
    catch {
        Write-Error "An error occurred: $($_.Exception.Message)"
        exit 1
    }
}

# Script parameters help
if ($args -contains "--help" -or $args -contains "-h") {
    Write-ColorOutput "Face Recognition Attendance System - Service Stop Script" "Magenta"
    Write-ColorOutput "Usage: .\stop-services.ps1 [options]" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Options:" "Yellow"
    Write-ColorOutput "  -Force              Force kill processes" "White"
    Write-ColorOutput "  -Verbose            Enable verbose output" "White"
    Write-ColorOutput "  -h, --help          Show this help message" "White"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" "Yellow"
    Write-ColorOutput "  .\stop-services.ps1              # Stop all services gracefully" "White"
    Write-ColorOutput "  .\stop-services.ps1 -Force        # Force stop all services" "White"
    exit 0
}

# Run main function
Main
