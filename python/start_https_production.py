#!/usr/bin/env python3
"""
HTTPS Production startup script for the Face Recognition Service
Uses Flask with SSL for HTTPS support on Windows
"""
import os
import sys
import signal
import time
from pathlib import Path

# Add the python directory to the path
python_dir = Path(__file__).parent
sys.path.insert(0, str(python_dir))

from recognizer_service import create_app, config

def start_https_production():
    """Start the service with HTTPS using Flask (production settings)"""
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
    
    # SSL configuration
    if config.service.ssl_enabled:
        ssl_cert = os.path.join(python_dir.parent, config.service.ssl_cert_path)
        ssl_key = os.path.join(python_dir.parent, config.service.ssl_key_path)
        
        if os.path.exists(ssl_cert) and os.path.exists(ssl_key):
            print(f"Starting HTTPS server with SSL certificates")
            print(f"Service will be available at: https://{config.service.host}:{config.service.port}")
            print("Note: This is a production-ready HTTPS server")
            
            # Handle shutdown gracefully
            def signal_handler(sig, frame):
                print("\nShutting down gracefully...")
                sys.exit(0)
            
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
            
            try:
                app.run(
                    host=config.service.host,
                    port=config.service.port,
                    debug=False,
                    threaded=True,
                    use_reloader=False,
                    ssl_context=(ssl_cert, ssl_key)
                )
            except Exception as e:
                print(f"HTTPS failed: {e}")
                print("Falling back to HTTP...")
                app.run(
                    host=config.service.host,
                    port=config.service.port,
                    debug=False,
                    threaded=True,
                    use_reloader=False
                )
        else:
            print(f"SSL certificates not found: {ssl_cert}, {ssl_key}")
            print("Starting HTTP server instead...")
            app.run(
                host=config.service.host,
                port=config.service.port,
                debug=False,
                threaded=True,
                use_reloader=False
            )
    else:
        print("SSL disabled, starting HTTP server")
        app.run(
            host=config.service.host,
            port=config.service.port,
            debug=False,
            threaded=True,
            use_reloader=False
        )

def main():
    """Main startup function"""
    print("=== Face Recognition Service - HTTPS Production Mode ===")
    config.print_config()
    
    start_https_production()

if __name__ == "__main__":
    main()





