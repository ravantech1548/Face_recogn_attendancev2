@echo off
REM Face Recognition System Service Manager
REM This script can be run from anywhere in the project folder

echo ========================================
echo Face Recognition System Service Manager
echo ========================================
echo.

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Check if we're in the project root or a subdirectory
if exist "%SCRIPT_DIR%python\service_manager.py" (
    set PYTHON_DIR=%SCRIPT_DIR%python
) else if exist "%SCRIPT_DIR%..\python\service_manager.py" (
    set PYTHON_DIR=%SCRIPT_DIR%..\python
) else if exist "%SCRIPT_DIR%..\..\python\service_manager.py" (
    set PYTHON_DIR=%SCRIPT_DIR%..\..\python
) else (
    echo Error: Could not find service_manager.py
    echo Please run this script from the project folder or a subdirectory
    pause
    exit /b 1
)

echo Found service manager at: %PYTHON_DIR%
echo.

REM Change to the python directory
cd /d "%PYTHON_DIR%"

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found at %PYTHON_DIR%\venv
    echo Make sure Python dependencies are installed
)

REM Check if service_manager.py exists
if not exist "service_manager.py" (
    echo Error: service_manager.py not found in %PYTHON_DIR%
    pause
    exit /b 1
)

echo.
echo Starting Service Manager...
echo Press Ctrl+C to stop all services
echo.

REM Run the service manager with all arguments passed through
python service_manager.py %*

REM If we get here, the script ended
echo.
echo Service Manager has stopped.
pause
