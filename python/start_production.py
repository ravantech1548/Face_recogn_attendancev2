#!/usr/bin/env python3
"""
Production startup script for the Face Recognition Service
Uses Gunicorn WSGI server for better performance and stability
"""
import os
import sys
import subprocess
import signal
import time
from pathlib import Path

# Add the python directory to the path
python_dir = Path(__file__).parent
sys.path.insert(0, str(python_dir))

from recognizer_service import create_app, config

def is_windows():
    """Check if running on Windows"""
    return os.name == 'nt' or sys.platform.startswith('win')

def install_gunicorn():
    """Install gunicorn if not available and not on Windows"""
    if is_windows():
        print("Gunicorn is not supported on Windows. Using Flask development server.")
        return False
    
    try:
        import gunicorn
        return True
    except ImportError:
        print("Installing gunicorn...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "gunicorn"])
            return True
        except subprocess.CalledProcessError:
            print("Failed to install gunicorn. Please install manually: pip install gunicorn")
            return False

def start_gunicorn():
    """Start the service with Gunicorn"""
    if not install_gunicorn():
        print("Falling back to Flask development server...")
        return False
    
    # Gunicorn configuration
    workers = min(4, (os.cpu_count() or 1) * 2 + 1)
    bind_address = f"{config.service.host}:{config.service.port}"
    
    # SSL configuration
    ssl_args = []
    if config.service.ssl_enabled:
        ssl_cert = os.path.join(python_dir.parent, config.service.ssl_cert_path)
        ssl_key = os.path.join(python_dir.parent, config.service.ssl_key_path)
        if os.path.exists(ssl_cert) and os.path.exists(ssl_key):
            ssl_args = ["--certfile", ssl_cert, "--keyfile", ssl_key]
        else:
            print("SSL certificates not found, falling back to HTTP")
    
    # Gunicorn command
    cmd = [
        "gunicorn",
        "--bind", bind_address,
        "--workers", str(workers),
        "--worker-class", "sync",
        "--worker-connections", "1000",
        "--max-requests", "1000",
        "--max-requests-jitter", "100",
        "--timeout", "120",
        "--keep-alive", "5",
        "--preload",
        "--access-logfile", "-",
        "--error-logfile", "-",
        "--log-level", "info",
        "--capture-output",
        "recognizer_service:create_app()"
    ] + ssl_args
    
    print(f"Starting Gunicorn with {workers} workers on {bind_address}")
    print(f"Command: {' '.join(cmd)}")
    
    try:
        process = subprocess.Popen(cmd, cwd=python_dir)
        
        # Handle shutdown gracefully
        def signal_handler(sig, frame):
            print("\nShutting down gracefully...")
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                print("Force killing process...")
                process.kill()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        # Wait for process
        process.wait()
        return True
        
    except Exception as e:
        print(f"Error starting Gunicorn: {e}")
        return False

def start_flask_dev():
    """Fallback to Flask development server with production settings"""
    print("Starting Flask development server with production settings...")
    from recognizer_service import app
    
    # Configure Flask for better performance
    app.config['MAX_CONTENT_LENGTH'] = config.service.max_upload_size
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    
    # Add error handlers
    @app.errorhandler(413)
    def too_large(e):
        return {"message": "File too large"}, 413
    
    @app.errorhandler(500)
    def internal_error(e):
        return {"message": "Internal server error"}, 500
    
    print(f"Starting server on {config.service.host}:{config.service.port}")
    print("Note: For production use on Windows, consider using waitress or uwsgi")
    
    app.run(
        host=config.service.host,
        port=config.service.port,
        debug=config.service.debug,
        threaded=True,
        use_reloader=False
    )

def main():
    """Main startup function"""
    print("=== Face Recognition Service - Production Mode ===")
    config.print_config()
    
    # Try Gunicorn first, fallback to Flask
    if not start_gunicorn():
        print("Gunicorn failed, starting Flask development server...")
        start_flask_dev()

if __name__ == "__main__":
    main()
