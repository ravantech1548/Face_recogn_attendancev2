"""
Configuration file for Face Recognition Service
Contains database and service configuration settings
"""

import os
from typing import Dict, Any

class DatabaseConfig:
    """Database configuration settings"""
    
    def __init__(self):
        self.user = os.getenv('DB_USER', 'faceapp_user')
        self.host = os.getenv('DB_HOST', '127.0.0.1')
        self.name = os.getenv('DB_NAME', 'face_recognition_attendance')
        self.password = os.getenv('DB_PASSWORD', 'qautomation')
        self.port = int(os.getenv('DB_PORT', '5432'))
        
        # Connection pool settings
        self.max_connections = int(os.getenv('DB_MAX_CONNECTIONS', '10'))
        self.min_connections = int(os.getenv('DB_MIN_CONNECTIONS', '1'))
        self.connection_timeout = int(os.getenv('DB_CONNECTION_TIMEOUT', '30'))
        
        # SSL settings
        self.ssl_mode = os.getenv('DB_SSL_MODE', 'prefer')
        self.ssl_cert = os.getenv('DB_SSL_CERT', '')
        self.ssl_key = os.getenv('DB_SSL_KEY', '')
        self.ssl_rootcert = os.getenv('DB_SSL_ROOTCERT', '')
    
    def get_connection_params(self) -> Dict[str, Any]:
        """Get database connection parameters"""
        params = {
            'user': self.user,
            'host': self.host,
            'dbname': self.name,
            'password': self.password,
            'port': self.port,
            'connect_timeout': self.connection_timeout
        }
        
        # Add SSL parameters if configured
        if self.ssl_mode and self.ssl_mode != 'disable':
            params['sslmode'] = self.ssl_mode
            if self.ssl_cert:
                params['sslcert'] = self.ssl_cert
            if self.ssl_key:
                params['sslkey'] = self.ssl_key
            if self.ssl_rootcert:
                params['sslrootcert'] = self.ssl_rootcert
        
        return params
    
    def get_connection_string(self) -> str:
        """Get database connection string"""
        ssl_params = ""
        if self.ssl_mode and self.ssl_mode != 'disable':
            ssl_params = f"&sslmode={self.ssl_mode}"
            if self.ssl_cert:
                ssl_params += f"&sslcert={self.ssl_cert}"
            if self.ssl_key:
                ssl_params += f"&sslkey={self.ssl_key}"
            if self.ssl_rootcert:
                ssl_params += f"&sslrootcert={self.ssl_rootcert}"
        
        return (
            f"postgresql://{self.user}:{self.password}@"
            f"{self.host}:{self.port}/{self.name}"
            f"?connect_timeout={self.connection_timeout}{ssl_params}"
        )

class ServiceConfig:
    """Service configuration settings"""
    
    def __init__(self):
        # Server settings
        self.host = os.getenv('SERVICE_HOST', '0.0.0.0')
        self.port = int(os.getenv('SERVICE_PORT', '8001'))
        self.debug = os.getenv('SERVICE_DEBUG', 'false').lower() == 'true'
        
        # SSL settings
        self.ssl_enabled = os.getenv('SERVICE_SSL_ENABLED', 'true').lower() == 'true'
        self.ssl_cert_path = os.getenv('SERVICE_SSL_CERT_PATH', 'ssl/cert.pem')
        self.ssl_key_path = os.getenv('SERVICE_SSL_KEY_PATH', 'ssl/key.pem')
        
        # Face recognition settings
        self.face_detection_model = os.getenv('FACE_DETECTION_MODEL', 'hog')  # hog or cnn
        self.face_encoding_model = os.getenv('FACE_ENCODING_MODEL', 'large')  # small or large
        self.face_distance_threshold = float(os.getenv('FACE_DISTANCE_THRESHOLD', '0.5'))  # 0.5 = 50% min confidence
        self.face_jitters = int(os.getenv('FACE_JITTERS', '1'))
        
        # Cache settings (0 = keep indefinitely until manual reload)
        self.cache_ttl = int(os.getenv('CACHE_TTL_SECONDS', '0'))
        self.max_cache_size = int(os.getenv('MAX_CACHE_SIZE', '100'))
        
        # Upload settings
        self.max_upload_size = int(os.getenv('MAX_UPLOAD_SIZE_MB', '10')) * 1024 * 1024  # Convert to bytes
        self.allowed_image_formats = os.getenv('ALLOWED_IMAGE_FORMATS', 'jpg,jpeg,png').split(',')
        
        # Logging settings
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.log_file = os.getenv('LOG_FILE', 'recognizer.log')
        self.log_max_size = int(os.getenv('LOG_MAX_SIZE_MB', '10')) * 1024 * 1024
        self.log_backup_count = int(os.getenv('LOG_BACKUP_COUNT', '5'))

class Config:
    """Main configuration class"""
    
    def __init__(self):
        self.database = DatabaseConfig()
        self.service = ServiceConfig()
    
    def validate(self) -> bool:
        """Validate configuration settings"""
        errors = []
        
        # Validate database settings
        if not self.database.user:
            errors.append("Database user is required")
        if not self.database.host:
            errors.append("Database host is required")
        if not self.database.name:
            errors.append("Database name is required")
        if not self.database.password:
            errors.append("Database password is required")
        if not (1 <= self.database.port <= 65535):
            errors.append("Database port must be between 1 and 65535")
        
        # Validate service settings
        if not (1 <= self.service.port <= 65535):
            errors.append("Service port must be between 1 and 65535")
        
        if self.service.ssl_enabled:
            if not os.path.exists(self.service.ssl_cert_path):
                errors.append(f"SSL certificate file not found: {self.service.ssl_cert_path}")
            if not os.path.exists(self.service.ssl_key_path):
                errors.append(f"SSL key file not found: {self.service.ssl_key_path}")
        
        # Validate face recognition settings
        if self.service.face_detection_model not in ['hog', 'cnn']:
            errors.append("Face detection model must be 'hog' or 'cnn'")
        if self.service.face_encoding_model not in ['small', 'large']:
            errors.append("Face encoding model must be 'small' or 'large'")
        if not (0.0 <= self.service.face_distance_threshold <= 1.0):
            errors.append("Face distance threshold must be between 0.0 and 1.0")
        
        if errors:
            print("Configuration validation errors:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        return True
    
    def print_config(self):
        """Print current configuration (without sensitive data)"""
        print("=== Face Recognition Service Configuration ===")
        print(f"Database:")
        print(f"  Host: {self.database.host}")
        print(f"  Port: {self.database.port}")
        print(f"  Database: {self.database.name}")
        print(f"  User: {self.database.user}")
        print(f"  SSL Mode: {self.database.ssl_mode}")
        print(f"  Connection Timeout: {self.database.connection_timeout}s")
        
        print(f"\nService:")
        print(f"  Host: {self.service.host}")
        print(f"  Port: {self.service.port}")
        print(f"  Debug: {self.service.debug}")
        print(f"  SSL Enabled: {self.service.ssl_enabled}")
        
        print(f"\nFace Recognition:")
        print(f"  Detection Model: {self.service.face_detection_model}")
        print(f"  Encoding Model: {self.service.face_encoding_model}")
        print(f"  Distance Threshold: {self.service.face_distance_threshold}")
        print(f"  Jitters: {self.service.face_jitters}")
        
        print(f"\nCache:")
        print(f"  TTL: {self.service.cache_ttl}s")
        print(f"  Max Size: {self.service.max_cache_size}")
        
        print(f"\nUpload:")
        print(f"  Max Size: {self.service.max_upload_size // (1024*1024)}MB")
        print(f"  Allowed Formats: {', '.join(self.service.allowed_image_formats)}")
        
        print(f"\nLogging:")
        print(f"  Level: {self.service.log_level}")
        print(f"  File: {self.service.log_file}")
        print(f"  Max Size: {self.service.log_max_size // (1024*1024)}MB")
        print(f"  Backup Count: {self.service.log_backup_count}")

# Global configuration instance
config = Config()

# Validate configuration on import
if not config.validate():
    print("Warning: Configuration validation failed!")
