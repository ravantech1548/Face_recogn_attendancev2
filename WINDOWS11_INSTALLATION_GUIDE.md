# Face Recognition Attendance System - Windows 11 Installation Guide

This comprehensive guide will help you deploy the Face Recognition Attendance System on Windows 11, including SSL certificate setup and all necessary configurations.

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Backend Installation](#backend-installation)
6. [Python Service Installation](#python-service-installation)
7. [Frontend Installation](#frontend-installation)
8. [Environment Configuration](#environment-configuration)
9. [Windows Service Configuration](#windows-service-configuration)
10. [Testing the Installation](#testing-the-installation)
11. [Production Deployment](#production-deployment)
12. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **OS**: Windows 11 (64-bit)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 20GB free space
- **CPU**: Intel Core i5 or AMD Ryzen 5 (4 cores minimum)
- **Network**: Stable internet connection
- **Graphics**: DirectX 11 compatible (for face recognition)

### Software Requirements
- **Node.js**: v16.0.0 or higher
- **Python**: 3.8 or higher
- **PostgreSQL**: 12 or higher
- **Git**: Latest version
- **Visual Studio Build Tools**: For Python dependencies

## Prerequisites

### 1. Install Node.js

#### Option A: Direct Download
1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the Windows Installer (.msi) for LTS version
3. Run the installer and follow the setup wizard
4. Verify installation:
```cmd
node --version
npm --version
```

#### Option B: Using Chocolatey
```powershell
# Install Chocolatey (if not already installed)
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs
```

#### Option C: Using Winget
```cmd
winget install OpenJS.NodeJS
```

### 2. Install Python

#### Option A: Direct Download
1. Go to [https://python.org/downloads/](https://python.org/downloads/)
2. Download Python 3.8+ for Windows
3. **Important**: Check "Add Python to PATH" during installation
4. Verify installation:
```cmd
python --version
pip --version
```

#### Option B: Using Microsoft Store
```cmd
# Search for Python in Microsoft Store and install
# Or use winget
winget install Python.Python.3.11
```

### 3. Install PostgreSQL

#### Option A: Direct Download
1. Go to [https://postgresql.org/download/windows/](https://postgresql.org/download/windows/)
2. Download PostgreSQL installer
3. Run installer and follow setup wizard
4. **Remember the password** you set for the postgres user
5. Verify installation:
```cmd
psql --version
```

#### Option B: Using Chocolatey
```powershell
choco install postgresql
```

### 4. Install Git

#### Option A: Direct Download
1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and run the installer
3. Use default settings during installation
4. Verify installation:
```cmd
git --version
```

#### Option B: Using Chocolatey
```powershell
choco install git
```

### 5. Install Visual Studio Build Tools
```powershell
# Install Visual Studio Build Tools for Python dependencies
choco install visualstudio2022buildtools
# Or download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
```

### 6. Install Additional Windows Features
```powershell
# Run PowerShell as Administrator
# Enable Windows Subsystem for Linux (optional but recommended)
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Windows Developer Mode
dism.exe /online /enable-feature /featurename:Microsoft-Windows-DeveloperMode /all /norestart
```

## Database Setup

### 1. Start PostgreSQL Service
```cmd
# Start PostgreSQL service
net start postgresql-x64-13
# Or use Services.msc to start PostgreSQL service

# Verify service is running
sc query postgresql-x64-13
```

### 2. Create Database and User

#### Using pgAdmin (GUI Method)
1. Open pgAdmin 4 (installed with PostgreSQL)
2. Connect to PostgreSQL server
3. Right-click "Databases" → "Create" → "Database"
4. Name: `face_recognition_attendance`
5. Right-click "Login/Group Roles" → "Create" → "Login/Group Role"
6. Name: `faceapp_user`
7. Go to "Definition" tab, set password
8. Go to "Privileges" tab, grant all necessary permissions

#### Using Command Line
```cmd
# Open Command Prompt as Administrator
# Navigate to PostgreSQL bin directory
cd "C:\Program Files\PostgreSQL\13\bin"

# Connect to PostgreSQL
psql -U postgres

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
```cmd
# Navigate to your project directory
cd C:\Face_recogn_attendancev1-main

# Run schema initialization
psql -U faceapp_user -d face_recognition_attendance -h localhost -f backend\sql\schema.sql
```

## SSL Certificate Setup

### Option 1: Self-Signed Certificates (Development/Testing)

#### Using OpenSSL (if installed)
```cmd
# Create SSL directory
mkdir ssl
cd ssl

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

#### Using PowerShell (Windows Native)
```powershell
# Create SSL directory
New-Item -ItemType Directory -Path "ssl" -Force
Set-Location ssl

# Generate self-signed certificate
$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddDays(365)
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "cert.pfx" -Password $pwd

# Convert to PEM format (requires OpenSSL or use online converter)
# Or use the .pfx file directly in your application
```

#### Using Git Bash (if Git is installed)
```bash
# Open Git Bash
# Navigate to project directory
cd /c/Face_recogn_attendancev1-main

# Create SSL directory
mkdir ssl
cd ssl

# Generate private key
openssl genrsa -out key.pem 2048

# Generate certificate
openssl req -new -x509 -key key.pem -out cert.pem -days 365 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### Option 2: Let's Encrypt (Production)

#### Using Certbot for Windows
1. Download Certbot for Windows from [https://certbot.eff.org/instructions?ws=other&os=windows](https://certbot.eff.org/instructions?ws=other&os=windows)
2. Run as Administrator:
```cmd
certbot certonly --standalone -d yourdomain.com
```
3. Copy certificates to ssl directory:
```cmd
copy "C:\Certbot\live\yourdomain.com\privkey.pem" "ssl\key.pem"
copy "C:\Certbot\live\yourdomain.com\fullchain.pem" "ssl\cert.pem"
```

### Option 3: Commercial SSL Certificate

1. Purchase SSL certificate from a trusted CA
2. Generate CSR (Certificate Signing Request):
```cmd
openssl req -new -newkey rsa:2048 -nodes -keyout ssl\key.pem -out ssl\cert.csr
```
3. Submit CSR to your CA
4. Install the received certificate as `ssl\cert.pem`

## Backend Installation

### 1. Clone and Setup
```cmd
# Open Command Prompt in desired directory
# Clone repository (replace with your repository URL)
git clone <repository-url>
cd Face_recogn_attendancev1-main

# Install dependencies
cd backend
npm install
```

### 2. Environment Configuration
```cmd
# Create .env file
echo # Database Configuration > .env
echo DB_USER=faceapp_user >> .env
echo DB_HOST=127.0.0.1 >> .env
echo DB_NAME=face_recognition_attendance >> .env
echo DB_PASSWORD=your_secure_password >> .env
echo DB_PORT=5432 >> .env
echo. >> .env
echo # Server Configuration >> .env
echo PORT=5000 >> .env
echo NODE_ENV=production >> .env
echo. >> .env
echo # JWT Configuration >> .env
echo JWT_SECRET=your_jwt_secret_key_here >> .env
echo. >> .env
echo # SSL Configuration >> .env
echo SSL_ENABLED=true >> .env
echo SSL_CERT_PATH=../ssl/cert.pem >> .env
echo SSL_KEY_PATH=../ssl/key.pem >> .env
```

### 3. Database Migration
```cmd
# Run all database migrations
node scripts\run_all_migrations.js

# Or run individual migrations if needed
node scripts\run_migration.js
```

### 4. Test Backend
```cmd
# Start backend server
npm start

# Test in another Command Prompt
curl -k https://localhost:5000/api/health
```

## Python Service Installation

### 1. Create Virtual Environment
```cmd
cd python
python -m venv venv

# Activate virtual environment
venv\Scripts\activate
```

### 2. Install Dependencies
```cmd
# Upgrade pip first
python -m pip install --upgrade pip

# Install Python packages
pip install -r requirements.txt

# Install additional Windows-specific packages
pip install pywin32
```

### 3. Environment Configuration
```cmd
# Create .env file for Python service
echo # Database Configuration > .env
echo DB_USER=faceapp_user >> .env
echo DB_HOST=127.0.0.1 >> .env
echo DB_NAME=face_recognition_attendance >> .env
echo DB_PASSWORD=your_secure_password >> .env
echo DB_PORT=5432 >> .env
echo. >> .env
echo # Service Configuration >> .env
echo SERVICE_HOST=0.0.0.0 >> .env
echo SERVICE_PORT=8001 >> .env
echo SERVICE_SSL_ENABLED=true >> .env
echo SERVICE_SSL_CERT_PATH=../ssl/cert.pem >> .env
echo SERVICE_SSL_KEY_PATH=../ssl/key.pem >> .env
echo. >> .env
echo # Face Recognition Configuration >> .env
echo FACE_DETECTION_MODEL=hog >> .env
echo FACE_ENCODING_MODEL=large >> .env
echo FACE_DISTANCE_THRESHOLD=0.6 >> .env
echo FACE_JITTERS=1 >> .env
echo. >> .env
echo # Cache Configuration >> .env
echo CACHE_TTL_SECONDS=60 >> .env
echo MAX_CACHE_SIZE=100 >> .env
echo. >> .env
echo # Upload Configuration >> .env
echo MAX_UPLOAD_SIZE_MB=10 >> .env
echo ALLOWED_IMAGE_FORMATS=jpg,jpeg,png >> .env
echo. >> .env
echo # Logging Configuration >> .env
echo LOG_LEVEL=INFO >> .env
echo LOG_FILE=recognizer.log >> .env
echo LOG_MAX_SIZE_MB=10 >> .env
echo LOG_BACKUP_COUNT=5 >> .env
```

### 4. Test Python Service
```cmd
# Start Python service
python recognizer_service.py

# Test in another Command Prompt
curl -k https://localhost:8001/health
```

## Frontend Installation

### 1. Install Dependencies
```cmd
cd frontend
npm install
```

### 2. Environment Configuration
```cmd
# Create .env file
echo VITE_API_URL=https://localhost:5000 > .env
echo VITE_RECOGNITION_SERVICE_URL=https://localhost:8001 >> .env
echo VITE_APP_TITLE=Face Recognition Attendance System >> .env
```

### 3. Build for Production
```cmd
# Build the application
npm run build

# The build will be in the 'dist' directory
```

### 4. Test Frontend
```cmd
# Preview the built application
npm run preview

# Or serve with a web server
npx serve -s dist -l 3000
```

## Environment Configuration

### 1. Create Master Environment File
```cmd
# In project root
echo # Database Configuration > .env
echo DB_USER=faceapp_user >> .env
echo DB_HOST=127.0.0.1 >> .env
echo DB_NAME=face_recognition_attendance >> .env
echo DB_PASSWORD=your_secure_password >> .env
echo DB_PORT=5432 >> .env
echo. >> .env
echo # Backend Configuration >> .env
echo BACKEND_PORT=5000 >> .env
echo BACKEND_HOST=0.0.0.0 >> .env
echo. >> .env
echo # Python Service Configuration >> .env
echo PYTHON_SERVICE_PORT=8001 >> .env
echo PYTHON_SERVICE_HOST=0.0.0.0 >> .env
echo. >> .env
echo # Frontend Configuration >> .env
echo FRONTEND_PORT=3000 >> .env
echo FRONTEND_HOST=0.0.0.0 >> .env
echo. >> .env
echo # SSL Configuration >> .env
echo SSL_CERT_PATH=ssl/cert.pem >> .env
echo SSL_KEY_PATH=ssl/key.pem >> .env
echo. >> .env
echo # JWT Configuration >> .env
echo JWT_SECRET=your_jwt_secret_key_here >> .env
echo. >> .env
echo # Environment >> .env
echo NODE_ENV=production >> .env
```

## Windows Service Configuration

### 1. Install PM2 for Process Management
```cmd
# Install PM2 globally
npm install -g pm2
npm install -g pm2-windows-startup

# Setup PM2 to start on Windows boot
pm2-startup install
```

### 2. Create PM2 Ecosystem File
```cmd
# Create ecosystem.config.js in project root
echo module.exports = { > ecosystem.config.js
echo   apps: [ >> ecosystem.config.js
echo     { >> ecosystem.config.js
echo       name: 'face-recognition-backend', >> ecosystem.config.js
echo       script: 'backend/server.js', >> ecosystem.config.js
echo       cwd: 'C:/Face_recogn_attendancev1-main', >> ecosystem.config.js
echo       env: { >> ecosystem.config.js
echo         NODE_ENV: 'production' >> ecosystem.config.js
echo       }, >> ecosystem.config.js
echo       instances: 1, >> ecosystem.config.js
echo       exec_mode: 'cluster', >> ecosystem.config.js
echo       max_memory_restart: '1G', >> ecosystem.config.js
echo       error_file: './logs/backend-error.log', >> ecosystem.config.js
echo       out_file: './logs/backend-out.log', >> ecosystem.config.js
echo       log_file: './logs/backend-combined.log', >> ecosystem.config.js
echo       time: true >> ecosystem.config.js
echo     }, >> ecosystem.config.js
echo     { >> ecosystem.config.js
echo       name: 'face-recognition-python', >> ecosystem.config.js
echo       script: 'python/recognizer_service.py', >> ecosystem.config.js
echo       interpreter: 'python', >> ecosystem.config.js
echo       cwd: 'C:/Face_recogn_attendancev1-main', >> ecosystem.config.js
echo       env: { >> ecosystem.config.js
echo         NODE_ENV: 'production' >> ecosystem.config.js
echo       }, >> ecosystem.config.js
echo       instances: 1, >> ecosystem.config.js
echo       max_memory_restart: '1G', >> ecosystem.config.js
echo       error_file: './logs/python-error.log', >> ecosystem.config.js
echo       out_file: './logs/python-out.log', >> ecosystem.config.js
echo       log_file: './logs/python-combined.log', >> ecosystem.config.js
echo       time: true >> ecosystem.config.js
echo     } >> ecosystem.config.js
echo   ] >> ecosystem.config.js
echo }; >> ecosystem.config.js
```

### 3. Create Logs Directory
```cmd
mkdir logs
```

### 4. Start Services with PM2
```cmd
# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check status
pm2 status

# View logs
pm2 logs
```

### 5. Install IIS for Frontend (Optional)

#### Enable IIS Features
```powershell
# Run PowerShell as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures
Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors
Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpLogging
Enable-WindowsOptionalFeature -Online -FeatureName IIS-RequestFiltering
Enable-WindowsOptionalFeature -Online -FeatureName IIS-StaticContent
Enable-WindowsOptionalFeature -Online -FeatureName IIS-DefaultDocument
Enable-WindowsOptionalFeature -Online -FeatureName IIS-DirectoryBrowsing
Enable-WindowsOptionalFeature -Online -FeatureName IIS-ASPNET45
```

#### Configure IIS for Frontend
1. Open IIS Manager
2. Create new site:
   - Site name: `Face Recognition Attendance`
   - Physical path: `C:\Face_recogn_attendancev1-main\frontend\dist`
   - Port: `80` (or `443` for HTTPS)
3. Configure URL Rewrite for SPA routing
4. Set up SSL binding if using HTTPS

### 6. Configure Windows Firewall
```powershell
# Run PowerShell as Administrator
# Allow Node.js through firewall
New-NetFirewallRule -DisplayName "Node.js Backend" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
New-NetFirewallRule -DisplayName "Python Service" -Direction Inbound -Protocol TCP -LocalPort 8001 -Action Allow
New-NetFirewallRule -DisplayName "Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow

# Allow PostgreSQL
New-NetFirewallRule -DisplayName "PostgreSQL" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow
```

## Database Migration (Important!)

### ⚠️ **CRITICAL**: SQL Migrations Must Be Run Manually

The system has several SQL migration files that are **NOT automatically run** during deployment. You must run them manually on the new machine.

### 1. Run All Migrations (Recommended)
```cmd
# Navigate to backend directory
cd backend

# Run all migrations at once
node scripts\run_all_migrations.js
```

### 2. Run Individual Migrations (If Needed)
```cmd
# Run specific migration scripts
node scripts\run_migration.js

# Or run SQL files directly
psql -U faceapp_user -d face_recognition_attendance -h localhost -f sql\migration_add_attendance_fields.sql
psql -U faceapp_user -d face_recognition_attendance -h localhost -f sql\migration_add_face_captures.sql
psql -U faceapp_user -d face_recognition_attendance -h localhost -f sql\migration_add_on_duty_enabled.sql
psql -U faceapp_user -d face_recognition_attendance -h localhost -f sql\migration_add_staff_work_fields.sql
psql -U faceapp_user -d face_recognition_attendance -h localhost -f sql\migration_add_password_reset.sql
```

### 3. Verify Migrations
```cmd
# Check if new columns exist
psql -U faceapp_user -d face_recognition_attendance -h localhost -c "\d attendance"
psql -U faceapp_user -d face_recognition_attendance -h localhost -c "\d staff"
```

## Testing the Installation

### 1. Health Checks
```cmd
# Backend health check
curl -k https://localhost:5000/api/health

# Python service health check
curl -k https://localhost:8001/health

# Frontend (if using IIS or npx serve)
curl http://localhost:3000
```

### 2. Database Connection Test
```cmd
# Test database connection
psql -U faceapp_user -d face_recognition_attendance -h localhost -c "SELECT version();"
```

### 3. SSL Certificate Test
```cmd
# Test SSL certificate
openssl s_client -connect localhost:5000 -servername localhost
openssl s_client -connect localhost:8001 -servername localhost
```

### 4. Full System Test
```cmd
# Run the provided test scripts
node test_attendance_api.js
python test_service.py
python test_liveness.py
```

### 5. Browser Testing
1. Open browser and navigate to `https://localhost:5000/api/health`
2. Accept SSL certificate warning (for self-signed certificates)
3. Navigate to frontend URL
4. Test the complete application flow

## Production Deployment

### 1. Security Hardening

#### Windows Defender Configuration
```powershell
# Run PowerShell as Administrator
# Add exclusions for your project directory
Add-MpPreference -ExclusionPath "C:\Face_recogn_attendancev1-main"
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "python.exe"
```

#### User Account Control
1. Create a dedicated service account for the application
2. Set up proper permissions for the service account
3. Configure Windows User Account Control (UAC) settings

#### Database Security
```cmd
# Edit PostgreSQL configuration
# Navigate to: C:\Program Files\PostgreSQL\13\data\
# Edit postgresql.conf:
# listen_addresses = 'localhost'
# ssl = on

# Edit pg_hba.conf:
# local   all             all                                     md5
# host    all             all             127.0.0.1/32            md5
```

### 2. Monitoring Setup

#### Event Log Monitoring
```powershell
# Create custom event log for application
New-EventLog -LogName "Face Recognition App" -Source "FaceRecognitionBackend"
New-EventLog -LogName "Face Recognition App" -Source "FaceRecognitionPython"
```

#### Performance Monitoring
```cmd
# Install Windows Performance Toolkit (optional)
# Download from Microsoft Store or Visual Studio installer
```

### 3. Backup Configuration

#### Database Backup Script
```cmd
# Create backup_db.bat
echo @echo off > backup_db.bat
echo set BACKUP_DIR=C:\Backups >> backup_db.bat
echo set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2% >> backup_db.bat
echo set DATE=%DATE: =0% >> backup_db.bat
echo mkdir "%BACKUP_DIR%" >> backup_db.bat
echo pg_dump -U faceapp_user -h localhost face_recognition_attendance > "%BACKUP_DIR%\db_backup_%DATE%.sql" >> backup_db.bat
echo echo Database backup completed: db_backup_%DATE%.sql >> backup_db.bat
```

#### File Backup Script
```cmd
# Create backup_files.bat
echo @echo off > backup_files.bat
echo set BACKUP_DIR=C:\Backups >> backup_files.bat
echo set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2% >> backup_files.bat
echo set DATE=%DATE: =0% >> backup_files.bat
echo mkdir "%BACKUP_DIR%" >> backup_files.bat
echo powershell Compress-Archive -Path "C:\Face_recogn_attendancev1-main\uploads" -DestinationPath "%BACKUP_DIR%\files_backup_%DATE%.zip" >> backup_files.bat
echo echo File backup completed: files_backup_%DATE%.zip >> backup_files.bat
```

#### Schedule Backups with Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily at 2 AM)
4. Set action to run backup scripts
5. Configure to run with highest privileges

### 4. Windows Service Installation (Alternative to PM2)

#### Using node-windows
```cmd
# Install node-windows
npm install -g node-windows

# Create service installation script
echo var Service = require('node-windows').Service; > install_service.js
echo var svc = new Service({ >> install_service.js
echo   name:'Face Recognition Backend', >> install_service.js
echo   description: 'Face Recognition Attendance System Backend', >> install_service.js
echo   script: 'C:\\Face_recogn_attendancev1-main\\backend\\server.js', >> install_service.js
echo   nodeOptions: [ >> install_service.js
echo     '--max_old_space_size=4096' >> install_service.js
echo   ] >> install_service.js
echo }); >> install_service.js
echo svc.on('install',function(){ >> install_service.js
echo   svc.start(); >> install_service.js
echo }); >> install_service.js
echo svc.install(); >> install_service.js

# Run as Administrator
node install_service.js
```

## Troubleshooting

### Common Issues

#### 1. SSL Certificate Issues
```cmd
# Check certificate validity
openssl x509 -in ssl\cert.pem -text -noout

# Test SSL connection
openssl s_client -connect localhost:5000 -servername localhost

# Regenerate self-signed certificate if needed
openssl req -x509 -newkey rsa:4096 -keyout ssl\key.pem -out ssl\cert.pem -days 365 -nodes
```

#### 2. Database Connection Issues
```cmd
# Check PostgreSQL service
sc query postgresql-x64-13

# Check database connectivity
psql -U faceapp_user -d face_recognition_attendance -h localhost

# Check PostgreSQL logs
type "C:\Program Files\PostgreSQL\13\data\log\postgresql-*.log"
```

#### 3. Service Not Starting
```cmd
# Check PM2 status
pm2 status

# Check PM2 logs
pm2 logs

# Restart services
pm2 restart all

# Check Windows Event Logs
eventvwr.msc
```

#### 4. Face Recognition Issues
```cmd
# Check Python dependencies
pip list | findstr "face-recognition opencv dlib"

# Test face recognition service
curl -k https://localhost:8001/health

# Check Python service logs
type python\recognizer.log
```

#### 5. Frontend Issues
```cmd
# Check if frontend is built
dir frontend\dist

# Rebuild frontend
cd frontend
npm run build

# Check IIS configuration (if using IIS)
# Open IIS Manager and check site configuration
```

#### 6. Windows-Specific Issues

##### Python Path Issues
```cmd
# Add Python to PATH permanently
setx PATH "%PATH%;C:\Python311;C:\Python311\Scripts" /M

# Restart Command Prompt after setting PATH
```

##### Node.js Permission Issues
```cmd
# Run Command Prompt as Administrator
# Or change npm global directory
npm config set prefix "C:\npm-global"
setx PATH "%PATH%;C:\npm-global" /M
```

##### Firewall Issues
```powershell
# Check Windows Firewall status
Get-NetFirewallProfile

# Temporarily disable firewall for testing
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Connect to PostgreSQL and run these commands
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_attendance_date_staff ON attendance(date, staff_id);
CREATE INDEX CONCURRENTLY idx_staff_active ON staff(is_active) WHERE is_active = true;

-- Analyze tables for query optimization
ANALYZE attendance;
ANALYZE staff;
ANALYZE users;
```

#### 2. Application Optimization
```cmd
# Increase Node.js memory limit
set NODE_OPTIONS=--max-old-space-size=4096

# Optimize Python service
set PYTHONOPTIMIZE=1
```

#### 3. Windows Optimization
```cmd
# Disable Windows Search indexing for project directory
# Right-click project folder → Properties → Advanced → Uncheck "Index this drive for faster searching"

# Set high performance power plan
powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Check PM2 status: `pm2 status`
- Monitor disk space
- Review error logs: `pm2 logs`

#### Weekly
- Run database backups
- Check SSL certificate expiration
- Review Windows Event Logs

#### Monthly
- Update Windows and installed software
- Review security logs
- Test backup restoration

### Update Procedure

1. **Backup current installation**
2. **Stop all services**: `pm2 stop all`
3. **Update code from repository**
4. **Run database migrations**
5. **Update dependencies**
6. **Test the update**
7. **Start services**: `pm2 start all`
8. **Verify functionality**

## Support

For additional support:
1. Check the troubleshooting section above
2. Review application logs in PM2
3. Check Windows Event Viewer
4. Verify system resources (CPU, memory, disk)
5. Test individual components

## Security Considerations

1. **Change default passwords**
2. **Use strong SSL certificates**
3. **Keep Windows and software updated**
4. **Monitor Windows Event Logs**
5. **Regular security audits**
6. **Backup encryption**
7. **Network security**
8. **Antivirus exclusions**

This Windows 11 installation guide provides a complete setup for deploying the Face Recognition Attendance System with SSL support on Windows. Follow each step carefully and test thoroughly before going live.
