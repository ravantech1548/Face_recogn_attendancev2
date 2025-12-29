@echo off
REM Face Recognition Attendance System - Service Stop Batch File
REM This batch file stops all services using the PowerShell script

echo.
echo ================================================================
echo   Face Recognition Attendance System - Service Stop
echo ================================================================
echo.

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: PowerShell is not available or not in PATH
    echo Please install PowerShell or add it to your PATH
    pause
    exit /b 1
)

REM Run the PowerShell script
echo Stopping services...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0stop-services.ps1" %*

REM Check if the script ran successfully
if %errorlevel% neq 0 (
    echo.
    echo Error: Service stop script failed
    echo Please check the error messages above
    pause
    exit /b %errorlevel%
)

echo.
echo Services stop completed
pause

