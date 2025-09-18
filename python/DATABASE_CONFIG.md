# Database Configuration Guide

This document explains how to configure the database settings for the Face Recognition Service.

## Environment Variables

Create a `.env` file in the python directory with the following variables:

```bash
# Database Configuration
DB_USER=faceapp_user
DB_HOST=127.0.0.1
DB_NAME=face_recognition_attendance
DB_PASSWORD=qautomation
DB_PORT=5432

# Database Connection Pool Settings
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=1
DB_CONNECTION_TIMEOUT=30

# Database SSL Settings
DB_SSL_MODE=prefer
DB_SSL_CERT=
DB_SSL_KEY=
DB_SSL_ROOTCERT=

# Service Configuration
SERVICE_HOST=0.0.0.0
SERVICE_PORT=8001
SERVICE_DEBUG=false

# SSL/TLS Settings
SERVICE_SSL_ENABLED=true
SERVICE_SSL_CERT_PATH=ssl/cert.pem
SERVICE_SSL_KEY_PATH=ssl/key.pem

# Face Recognition Settings
FACE_DETECTION_MODEL=hog
FACE_ENCODING_MODEL=large
FACE_DISTANCE_THRESHOLD=0.6
FACE_JITTERS=1

# Cache Settings
CACHE_TTL_SECONDS=60
MAX_CACHE_SIZE=100

# Upload Settings
MAX_UPLOAD_SIZE_MB=10
ALLOWED_IMAGE_FORMATS=jpg,jpeg,png

# Logging Settings
LOG_LEVEL=INFO
LOG_FILE=recognizer.log
LOG_MAX_SIZE_MB=10
LOG_BACKUP_COUNT=5
```

## Configuration Options

### Database Settings

#### DB_USER
- **Description**: PostgreSQL username
- **Default**: `faceapp_user`
- **Example**: `my_user`

#### DB_HOST
- **Description**: Database server hostname or IP address
- **Default**: `127.0.0.1`
- **Example**: `192.168.1.100` or `db.example.com`

#### DB_NAME
- **Description**: Database name
- **Default**: `face_recognition_attendance`
- **Example**: `my_face_db`

#### DB_PASSWORD
- **Description**: Database password
- **Default**: `qautomation`
- **Security**: Use strong passwords in production

#### DB_PORT
- **Description**: Database port
- **Default**: `5432`
- **Example**: `5433` for custom PostgreSQL port

### Connection Pool Settings

#### DB_MAX_CONNECTIONS
- **Description**: Maximum number of database connections in pool
- **Default**: `10`
- **Example**: `20` for high-traffic applications

#### DB_MIN_CONNECTIONS
- **Description**: Minimum number of database connections in pool
- **Default**: `1`
- **Example**: `5` for always-ready connections

#### DB_CONNECTION_TIMEOUT
- **Description**: Connection timeout in seconds
- **Default**: `30`
- **Example**: `60` for slow networks

### SSL Settings

#### DB_SSL_MODE
- **Description**: SSL connection mode
- **Default**: `prefer`
- **Options**: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`

#### DB_SSL_CERT
- **Description**: Path to client SSL certificate
- **Default**: Empty (not required)
- **Example**: `/path/to/client-cert.pem`

#### DB_SSL_KEY
- **Description**: Path to client SSL private key
- **Default**: Empty (not required)
- **Example**: `/path/to/client-key.pem`

#### DB_SSL_ROOTCERT
- **Description**: Path to root CA certificate
- **Default**: Empty (not required)
- **Example**: `/path/to/ca-cert.pem`

### Service Settings

#### SERVICE_HOST
- **Description**: Host interface to bind the service
- **Default**: `0.0.0.0` (all interfaces)
- **Example**: `127.0.0.1` for localhost only

#### SERVICE_PORT
- **Description**: Port for the recognition service
- **Default**: `8001`
- **Example**: `8080` for alternative port

#### SERVICE_DEBUG
- **Description**: Enable debug mode
- **Default**: `false`
- **Example**: `true` for development

### SSL/TLS Settings

#### SERVICE_SSL_ENABLED
- **Description**: Enable HTTPS for the service
- **Default**: `true`
- **Example**: `false` for HTTP only

#### SERVICE_SSL_CERT_PATH
- **Description**: Path to SSL certificate file
- **Default**: `ssl/cert.pem`
- **Example**: `/etc/ssl/certs/my-cert.pem`

#### SERVICE_SSL_KEY_PATH
- **Description**: Path to SSL private key file
- **Default**: `ssl/key.pem`
- **Example**: `/etc/ssl/private/my-key.pem`

### Face Recognition Settings

#### FACE_DETECTION_MODEL
- **Description**: Face detection model to use
- **Default**: `hog`
- **Options**: `hog` (faster), `cnn` (more accurate)

#### FACE_ENCODING_MODEL
- **Description**: Face encoding model to use
- **Default**: `large`
- **Options**: `small` (faster), `large` (more accurate)

#### FACE_DISTANCE_THRESHOLD
- **Description**: Maximum distance for face matching
- **Default**: `0.6`
- **Range**: `0.0` to `1.0` (lower = stricter matching)

#### FACE_JITTERS
- **Description**: Number of times to encode face for better accuracy
- **Default**: `1`
- **Example**: `10` for higher accuracy

### Cache Settings

#### CACHE_TTL_SECONDS
- **Description**: Cache time-to-live in seconds
- **Default**: `60`
- **Example**: `300` for 5-minute cache

#### MAX_CACHE_SIZE
- **Description**: Maximum number of cached items
- **Default**: `100`
- **Example**: `500` for larger cache

### Upload Settings

#### MAX_UPLOAD_SIZE_MB
- **Description**: Maximum upload size in megabytes
- **Default**: `10`
- **Example**: `50` for larger images

#### ALLOWED_IMAGE_FORMATS
- **Description**: Comma-separated list of allowed image formats
- **Default**: `jpg,jpeg,png`
- **Example**: `jpg,jpeg,png,bmp,tiff`

### Logging Settings

#### LOG_LEVEL
- **Description**: Logging level
- **Default**: `INFO`
- **Options**: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

#### LOG_FILE
- **Description**: Log file path
- **Default**: `recognizer.log`
- **Example**: `/var/log/face-recognition.log`

#### LOG_MAX_SIZE_MB
- **Description**: Maximum log file size in megabytes
- **Default**: `10`
- **Example**: `100` for larger log files

#### LOG_BACKUP_COUNT
- **Description**: Number of backup log files to keep
- **Default**: `5`
- **Example**: `10` for more backups

## Usage

### Loading Configuration

```python
from config import config

# Access database configuration
db_params = config.database.get_connection_params()
connection_string = config.database.get_connection_string()

# Access service configuration
service_port = config.service.port
ssl_enabled = config.service.ssl_enabled

# Print current configuration
config.print_config()
```

### Validation

The configuration is automatically validated when imported:

```python
from config import config

if config.validate():
    print("Configuration is valid")
else:
    print("Configuration has errors")
```

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for database connections
3. **Enable SSL** for production environments
4. **Restrict database access** to necessary IP addresses
5. **Use environment-specific configurations** for different deployments

## Troubleshooting

### Connection Issues
- Verify database host and port are correct
- Check firewall settings
- Ensure database service is running
- Verify credentials are correct

### SSL Issues
- Ensure certificate files exist and are readable
- Check certificate validity and expiration
- Verify SSL mode matches database configuration

### Performance Issues
- Adjust connection pool settings
- Optimize face recognition model settings
- Increase cache TTL for better performance
- Monitor database connection usage
