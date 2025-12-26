# Face Recognition Attendance System - Installation Guide

This comprehensive guide will help you deploy the Face Recognition Attendance System to a new machine, including SSL certificate setup and all necessary configurations.

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Backend Installation](#backend-installation)
6. [Python Service Installation](#python-service-installation)
7. [Frontend Installation](#frontend-installation)
8. [Environment Configuration](#environment-configuration)
9. [Service Configuration](#service-configuration)
10. [Testing the Installation](#testing-the-installation)
11. [Production Deployment](#production-deployment)
12. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **OS**: Windows 10/11, Ubuntu 18.04+, or macOS 10.15+
- **RAM**: 8GB (16GB recommended)
- **Storage**: 20GB free space
- **CPU**: 4 cores (8 cores recommended)
- **Network**: Stable internet connection

### Software Requirements
- **Node.js**: v16.0.0 or higher
- **Python**: 3.8 or higher
- **PostgreSQL**: 12 or higher
- **Git**: Latest version

## Prerequisites

### 1. Install Node.js
```bash
# Download and install Node.js from https://nodejs.org/
# Or use package manager:

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Windows (using Chocolatey)
choco install nodejs

# macOS (using Homebrew)
brew install node
```

### 2. Install Python
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# Windows
# Download from https://python.org/downloads/

# macOS
brew install python3
```

### 3. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Windows
# Download from https://postgresql.org/download/windows/

# macOS
brew install postgresql
```

### 4. Install Git
```bash
# Ubuntu/Debian
sudo apt install git

# Windows
# Download from https://git-scm.com/download/win

# macOS
brew install git
```

## Database Setup

### 1. Start PostgreSQL Service
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Windows
# Start PostgreSQL service from Services.msc

# macOS
brew services start postgresql
```

### 2. Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE face_recognition_attendance;

# Create user
CREATE USER faceapp_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE face_recognition_attendance TO faceapp_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO faceapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO faceapp_user;

# Exit PostgreSQL
\q
```

### 3. Initialize Database Schema
```bash
# Connect to database and run schema
psql -U faceapp_user -d face_recognition_attendance -h localhost -f backend/sql/schema.sql
```

## SSL Certificate Setup

### Option 1: Self-Signed Certificates (Development/Testing)

```bash
# Create SSL directory
mkdir ssl
cd ssl

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set proper permissions
chmod 600 key.pem
chmod 644 cert.pem
```

### Option 2: Let's Encrypt (Production)

```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to ssl directory
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem

# Set proper permissions
sudo chown $USER:$USER ssl/*.pem
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem
```

### Option 3: Commercial SSL Certificate

1. Purchase SSL certificate from a trusted CA
2. Generate CSR (Certificate Signing Request):
```bash
openssl req -new -newkey rsa:2048 -nodes -keyout ssl/key.pem -out ssl/cert.csr
```
3. Submit CSR to your CA
4. Install the received certificate as `ssl/cert.pem`

## Backend Installation

### 1. Clone and Setup
```bash
# Clone repository
git clone <repository-url>
cd Face_recogn_attendancev2-main

# Install dependencies
cd backend
npm install
```

### 2. Environment Configuration
```bash
# Create .env file
cat > .env << EOF
# Database Configuration
DB_USER=faceapp_user
DB_HOST=127.0.0.1
DB_NAME=face_recognition_attendance
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Server Configuration
PORT=5000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# SSL Configuration
SSL_ENABLED=true
SSL_CERT_PATH=../ssl/cert.pem
SSL_KEY_PATH=../ssl/key.pem
EOF
```

### 3. Database Migration
```bash
# Run database migrations
node scripts/run_migration.js
```

### 4. Test Backend
```bash
# Start backend server
npm start

# Test in another terminal
curl -k https://localhost:5000/api/health
```

## Python Service Installation

### 1. Create Virtual Environment
```bash
cd python
python3 -m venv venv

# Activate virtual environment
# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate
```

### 2. Install Dependencies
```bash
# Install Python packages
pip install -r requirements.txt

# Install additional system dependencies (Ubuntu/Debian)
sudo apt install libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1

# For face recognition (Ubuntu/Debian)
sudo apt install libopencv-dev python3-opencv
```

### 3. Environment Configuration
```bash
# Create .env file for Python service
cat > .env << EOF
# Database Configuration
DB_USER=faceapp_user
DB_HOST=127.0.0.1
DB_NAME=face_recognition_attendance
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Service Configuration
SERVICE_HOST=0.0.0.0
SERVICE_PORT=8001
SERVICE_SSL_ENABLED=true
SERVICE_SSL_CERT_PATH=../ssl/cert.pem
SERVICE_SSL_KEY_PATH=../ssl/key.pem

# Face Recognition Configuration
FACE_DETECTION_MODEL=hog
FACE_ENCODING_MODEL=large
FACE_DISTANCE_THRESHOLD=0.6
FACE_JITTERS=1

# Cache Configuration
CACHE_TTL_SECONDS=60
MAX_CACHE_SIZE=100

# Upload Configuration
MAX_UPLOAD_SIZE_MB=10
ALLOWED_IMAGE_FORMATS=jpg,jpeg,png

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=recognizer.log
LOG_MAX_SIZE_MB=10
LOG_BACKUP_COUNT=5
EOF
```

### 4. Test Python Service
```bash
# Start Python service
python recognizer_service.py

# Test in another terminal
curl -k https://localhost:8001/health
```

## Frontend Installation

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Environment Configuration
```bash
# Create .env file
cat > .env << EOF
VITE_API_URL=https://localhost:5000
VITE_RECOGNITION_SERVICE_URL=https://localhost:8001
VITE_APP_TITLE=Face Recognition Attendance System
EOF
```

### 3. Build for Production
```bash
# Build the application
npm run build

# The build will be in the 'dist' directory
```

### 4. Test Frontend
```bash
# Preview the built application
npm run preview

# Or serve with a web server
npx serve -s dist -l 3000
```

## Environment Configuration

### 1. Create Master Environment File
```bash
# In project root
cat > .env << EOF
# Database Configuration
DB_USER=faceapp_user
DB_HOST=127.0.0.1
DB_NAME=face_recognition_attendance
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Backend Configuration
BACKEND_PORT=5000
BACKEND_HOST=0.0.0.0

# Python Service Configuration
PYTHON_SERVICE_PORT=8001
PYTHON_SERVICE_HOST=0.0.0.0

# Frontend Configuration
FRONTEND_PORT=3000
FRONTEND_HOST=0.0.0.0

# SSL Configuration
SSL_CERT_PATH=ssl/cert.pem
SSL_KEY_PATH=ssl/key.pem

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here

# Environment
NODE_ENV=production
EOF
```

## Service Configuration

### 1. Create Systemd Services (Linux)

#### Backend Service
```bash
sudo cat > /etc/systemd/system/face-recognition-backend.service << EOF
[Unit]
Description=Face Recognition Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/project/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/path/to/your/project/.env

[Install]
WantedBy=multi-user.target
EOF
```

#### Python Service
```bash
sudo cat > /etc/systemd/system/face-recognition-python.service << EOF
[Unit]
Description=Face Recognition Python Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/project/python
ExecStart=/path/to/your/project/python/venv/bin/python recognizer_service.py
Restart=always
RestartSec=10
EnvironmentFile=/path/to/your/project/.env

[Install]
WantedBy=multi-user.target
EOF
```

#### Frontend Service (Nginx)
```bash
sudo cat > /etc/nginx/sites-available/face-recognition << EOF
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/your/project/ssl/cert.pem;
    ssl_certificate_key /path/to/your/project/ssl/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    root /path/to/your/project/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass https://localhost:5000;
        proxy_ssl_verify off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /recognize {
        proxy_pass https://localhost:8001;
        proxy_ssl_verify off;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/face-recognition /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Enable and Start Services
```bash
# Enable services
sudo systemctl enable face-recognition-backend
sudo systemctl enable face-recognition-python
sudo systemctl enable nginx

# Start services
sudo systemctl start face-recognition-backend
sudo systemctl start face-recognition-python
sudo systemctl start nginx

# Check status
sudo systemctl status face-recognition-backend
sudo systemctl status face-recognition-python
sudo systemctl status nginx
```

## Testing the Installation

### 1. Health Checks
```bash
# Backend health check
curl -k https://localhost:5000/api/health

# Python service health check
curl -k https://localhost:8001/health

# Frontend (through nginx)
curl -k https://yourdomain.com
```

### 2. Database Connection Test
```bash
# Test database connection
psql -U faceapp_user -d face_recognition_attendance -h localhost -c "SELECT version();"
```

### 3. SSL Certificate Test
```bash
# Test SSL certificate
openssl s_client -connect localhost:5000 -servername localhost
openssl s_client -connect localhost:8001 -servername localhost
```

### 4. Full System Test
```bash
# Run the provided test scripts
node test_attendance_api.js
python test_service.py
python test_liveness.py
```

## Production Deployment

### 1. Security Hardening

#### Firewall Configuration
```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Or with iptables
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5000 -j DROP
sudo iptables -A INPUT -p tcp --dport 8001 -j DROP
```

#### Database Security
```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf

# Set these values:
listen_addresses = 'localhost'
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'

# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add this line:
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

### 2. Monitoring Setup

#### Log Rotation
```bash
# Create logrotate configuration
sudo cat > /etc/logrotate.d/face-recognition << EOF
/path/to/your/project/backend/server.log
/path/to/your/project/python/recognizer.log
/path/to/your/project/frontend/frontend.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload face-recognition-backend
        systemctl reload face-recognition-python
    endscript
}
EOF
```

#### Process Monitoring
```bash
# Install PM2 for Node.js process management
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'face-recognition-backend',
      script: 'backend/server.js',
      cwd: '/path/to/your/project',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
};
EOF
```

### 3. Backup Configuration

#### Database Backup
```bash
# Create backup script
cat > backup_db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="face_recognition_attendance"

mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -U faceapp_user -h localhost $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 30 days of backups
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: db_backup_$DATE.sql.gz"
EOF

chmod +x backup_db.sh

# Add to crontab for daily backups
crontab -e
# Add this line:
0 2 * * * /path/to/backup_db.sh
```

#### File Backup
```bash
# Create file backup script
cat > backup_files.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/path/to/your/project"

mkdir -p $BACKUP_DIR

# Backup uploads and important files
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz \
    $PROJECT_DIR/uploads \
    $PROJECT_DIR/ssl \
    $PROJECT_DIR/.env

# Keep only last 7 days of file backups
find $BACKUP_DIR -name "files_backup_*.tar.gz" -mtime +7 -delete

echo "File backup completed: files_backup_$DATE.tar.gz"
EOF

chmod +x backup_files.sh
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:5000 -servername localhost

# Regenerate self-signed certificate if needed
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql -U faceapp_user -d face_recognition_attendance -h localhost

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 3. Service Not Starting
```bash
# Check service logs
sudo journalctl -u face-recognition-backend -f
sudo journalctl -u face-recognition-python -f

# Check service status
sudo systemctl status face-recognition-backend
sudo systemctl status face-recognition-python

# Restart services
sudo systemctl restart face-recognition-backend
sudo systemctl restart face-recognition-python
```

#### 4. Face Recognition Issues
```bash
# Check Python dependencies
pip list | grep -E "(face-recognition|opencv|dlib)"

# Test face recognition service
curl -k https://localhost:8001/health

# Check Python service logs
tail -f python/recognizer.log
```

#### 5. Frontend Issues
```bash
# Check if frontend is built
ls -la frontend/dist/

# Rebuild frontend
cd frontend
npm run build

# Check nginx configuration
sudo nginx -t

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_attendance_date_staff ON attendance(date, staff_id);
CREATE INDEX CONCURRENTLY idx_staff_active ON staff(is_active) WHERE is_active = true;

-- Analyze tables for query optimization
ANALYZE attendance;
ANALYZE staff;
ANALYZE users;
```

#### 2. Application Optimization
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Optimize Python service
export PYTHONOPTIMIZE=1
```

#### 3. System Optimization
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize PostgreSQL
sudo nano /etc/postgresql/*/main/postgresql.conf
# Add these settings:
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check service status
- Monitor disk space
- Review error logs

#### Weekly
- Run database backups
- Check SSL certificate expiration
- Review system performance

#### Monthly
- Update system packages
- Review security logs
- Test backup restoration

### Update Procedure

1. **Backup current installation**
2. **Stop all services**
3. **Update code from repository**
4. **Run database migrations**
5. **Update dependencies**
6. **Test the update**
7. **Start services**
8. **Verify functionality**

## Support

For additional support:
1. Check the troubleshooting section above
2. Review application logs
3. Check system resources (CPU, memory, disk)
4. Verify network connectivity
5. Test individual components

## Security Considerations

1. **Change default passwords**
2. **Use strong SSL certificates**
3. **Keep system updated**
4. **Monitor access logs**
5. **Regular security audits**
6. **Backup encryption**
7. **Network security**

This installation guide provides a complete setup for deploying the Face Recognition Attendance System with SSL support. Follow each step carefully and test thoroughly before going live.
