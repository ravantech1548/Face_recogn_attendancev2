#!/usr/bin/env python3
"""
Face Recognition System Service Manager Launcher
This script can be run from anywhere in the project folder
"""
import os
import sys
import subprocess
from pathlib import Path

def find_python_dir():
    """Find the python directory containing service_manager.py"""
    current_dir = Path(__file__).parent.absolute()
    
    # Check current directory and parent directories
    for check_dir in [current_dir, current_dir.parent, current_dir.parent.parent]:
        python_dir = check_dir / "python"
        if python_dir.exists() and (python_dir / "service_manager.py").exists():
            return python_dir
    
    return None

def main():
    print("=" * 40)
    print("Face Recognition System Service Manager")
    print("=" * 40)
    print()
    
    # Find the python directory
    python_dir = find_python_dir()
    
    if not python_dir:
        print("Error: Could not find service_manager.py")
        print("Please run this script from the project folder or a subdirectory")
        input("Press Enter to exit...")
        sys.exit(1)
    
    print(f"Found service manager at: {python_dir}")
    print()
    
    # Change to the python directory
    os.chdir(python_dir)
    
    # Check if virtual environment exists
    venv_activate = python_dir / "venv" / "Scripts" / "activate.bat"
    if venv_activate.exists():
        print("Virtual environment found, but Python launcher will use system Python")
        print("Make sure required packages are installed")
    else:
        print("Warning: Virtual environment not found")
        print("Make sure Python dependencies are installed")
    
    print()
    print("Starting Service Manager...")
    print("Press Ctrl+C to stop all services")
    print()
    
    try:
        # Run the service manager with all arguments passed through
        subprocess.run([sys.executable, "service_manager.py"] + sys.argv[1:])
    except KeyboardInterrupt:
        print("\nService Manager stopped by user")
    except Exception as e:
        print(f"Error running service manager: {e}")
    
    print()
    print("Service Manager has stopped.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
