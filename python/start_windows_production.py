#!/usr/bin/env python3
"""
Windows-specific production startup script for the Face Recognition Service
Uses Waitress WSGI server which is Windows-compatible
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

def install_waitress():
    """Install waitress if not available"""
    try:
        import waitress
        return True
    except ImportError:
        print("Installing waitress...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "waitress"])
            return True
        except subprocess.CalledProcessError:
            print("Failed to install waitress. Please install manually: pip install waitress")
            return False

def start_waitress():
    """Start the service with Waitress (Windows-compatible)"""
    if not install_waitress():
        print("Falling back to Flask development server...")
        return False
    
    # Create the app
    app = create_app()
    
    # Configure Flask for production
    app.config['MAX_CONTENT_LENGTH'] = config.service.max_upload_size
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    
    # Add error handlers
    @app.errorhandler(413)
    def too_large(e):
        return {"message": "File too large"}, 413
    
    @app.errorhandler(500)
    def internal_error(e):
        return {"message": "Internal server error"}, 500
    
    # Waitress configuration
    bind_address = f"{config.service.host}:{config.service.port}"
    threads = min(8, (os.cpu_count() or 1) * 2)
    
    print(f"Starting Waitress with {threads} threads on {bind_address}")
    
    try:
        # Import waitress here to avoid import errors if not installed
        import waitress
        
        # Waitress doesn't support SSL directly, so we'll use HTTP with Waitress
        # For HTTPS, we'll fall back to Flask with SSL
        if config.service.ssl_enabled:
            ssl_cert = os.path.join(python_dir.parent, config.service.ssl_cert_path)
            ssl_key = os.path.join(python_dir.parent, config.service.ssl_key_path)
            if os.path.exists(ssl_cert) and os.path.exists(ssl_key):
                print("Waitress doesn't support SSL directly.")
                print("For HTTPS production, use a reverse proxy like nginx or Apache.")
                print("Starting HTTP server with Waitress...")
            else:
                print("SSL certificates not found, starting HTTP server")
        
        print(f"Starting Waitress HTTP server on {config.service.host}:{config.service.port}")
        waitress.serve(
            app,
            host=config.service.host,
            port=config.service.port,
            threads=threads,
            connection_limit=1000,
            cleanup_interval=30,
            channel_timeout=120,
            log_socket_errors=True
        )
        
        return True
        
    except Exception as e:
        print(f"Error starting Waitress: {e}")
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
    
    app.run(
        host=config.service.host,
        port=config.service.port,
        debug=config.service.debug,
        threaded=True,
        use_reloader=False
    )

def main():
    """Main startup function"""
    print("=== Face Recognition Service - Windows Production Mode ===")
    config.print_config()
    
    # Try Waitress first, fallback to Flask
    if not start_waitress():
        print("Waitress failed, starting Flask development server...")
        start_flask_dev()

if __name__ == "__main__":
    main()
