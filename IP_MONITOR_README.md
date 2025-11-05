# IP Address Monitor for Face Recognition System

This system automatically monitors your server's IP address and updates configuration files when the IP changes, solving the dynamic IP allocation issue.

## Features

- **Automatic IP Detection**: Monitors network interfaces and detects IP changes
- **Configuration Updates**: Automatically updates `.env` and `frontend/src/config/api.js` files
- **Service Testing**: Tests service connectivity before updating configurations
- **Backup System**: Creates backups of configuration files before modifications
- **Service Management**: Optional service restart functionality
- **Logging**: Comprehensive logging of all operations

## Files Created

### Core Files
- `ip_monitor.py` - Main IP monitoring program
- `service_manager.py` - Service management and restart functionality
- `ip_monitor_config.json` - Configuration file for the monitor

### Startup Scripts
- `start_ip_monitor.bat` - Start IP monitoring only
- `start_system.bat` - Start complete system with IP monitoring and service management

### Test Files
- `test_ip_monitor.py` - Test script to verify functionality

## Usage

### Option 1: IP Monitoring Only
```bash
# Start IP monitoring
start_ip_monitor.bat

# Or manually
python ip_monitor.py
```

### Option 2: Complete System Management
```bash
# Start IP monitoring + service management
start_system.bat
```

### Option 3: Manual Service Management
```bash
# Start service manager only
python service_manager.py
```

## How It Works

### IP Monitoring Process
1. **Detection**: Continuously monitors network interfaces for IP changes
2. **Verification**: Tests if the face recognition service is accessible at the new IP
3. **Backup**: Creates timestamped backups of configuration files
4. **Update**: Updates `.env` and `api.js` files with the new IP
5. **Logging**: Records all operations in `ip_monitor.log`

### Configuration Files Updated

#### `.env` File
Updates these variables:
- `SERVICE_HOST=NEW_IP`
- `DB_HOST=NEW_IP`

#### `frontend/src/config/api.js`
Updates all HTTP/HTTPS URLs containing IP addresses to use the new IP.

### Backup System
- Creates backups in `ip_monitor_backups/` directory
- Keeps last 10 backups by default
- Timestamped filenames for easy identification

## Configuration

Edit `ip_monitor_config.json` to customize:

```json
{
    "monitoring": {
        "check_interval_seconds": 60,    // How often to check for IP changes
        "service_port": 8001,            // Port of the recognition service
        "timeout_seconds": 5             // Connection timeout
    },
    "files_to_update": {
        ".env": {
            "enabled": true,
            "ip_patterns": ["SERVICE_HOST=", "DB_HOST="]
        }
    },
    "backup": {
        "enabled": true,
        "keep_backups": 10               // Number of backups to keep
    }
}
```

## Service Management

The service manager can:
- Start all services (backend, recognizer, frontend)
- Monitor services and restart if they fail
- Stop all services gracefully
- Handle process cleanup

### Services Managed
1. **Backend** (Node.js) - Port 3001
2. **Recognizer** (Python) - Port 8001
3. **Frontend** (React) - Port 3000

## Testing

Run the test script to verify everything works:

```bash
python test_ip_monitor.py
```

This will test:
- IP detection functionality
- File operations
- Service connectivity
- Backup directory creation

## Logs

### IP Monitor Logs
- File: `ip_monitor.log`
- Contains: IP changes, configuration updates, service tests

### Service Manager Logs
- File: `service_manager.log`
- Contains: Service start/stop events, restart attempts

## Troubleshooting

### Common Issues

1. **Service Not Found**
   - Check if services are running on expected ports
   - Verify firewall settings
   - Check service logs

2. **Permission Errors**
   - Run as administrator if needed
   - Check file permissions for configuration files

3. **IP Detection Issues**
   - Ensure network connectivity
   - Check network interface configuration

### Manual Override

If automatic detection fails:
1. Manually update `.env` file with correct IP
2. Manually update `frontend/src/config/api.js` with correct IP
3. Restart services manually

## Benefits

- **No Manual Intervention**: Automatically handles IP changes
- **Zero Downtime**: Updates configurations without stopping services
- **Backup Safety**: Always backs up before making changes
- **Comprehensive Logging**: Full audit trail of all operations
- **Service Management**: Optional automatic service restart
- **Windows Compatible**: Designed specifically for Windows environments

## Production Use

For production environments:

1. **Run as Service**: Use Windows Task Scheduler to run at startup
2. **Monitor Logs**: Set up log monitoring for alerts
3. **Test Regularly**: Run test script periodically
4. **Backup Strategy**: Ensure backup directory is included in system backups

## Security Notes

- The monitor only updates local configuration files
- No external network calls except for IP detection
- All operations are logged for audit purposes
- Backup files preserve original configurations

This system eliminates the need to manually update IP addresses every time your server's IP changes, providing a robust solution for dynamic IP environments.







