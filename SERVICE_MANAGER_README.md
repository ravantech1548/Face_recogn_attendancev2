# Face Recognition System Service Manager

A comprehensive service manager that handles all Face Recognition System services with integrated IP monitoring and automatic configuration updates.

## Features

- **Service Management**: Automatically starts, stops, and monitors all system services
- **IP Monitoring**: Detects IP address changes and updates configuration files automatically
- **Auto-Restart**: Automatically restarts failed services
- **Windows Compatible**: Fully optimized for Windows environments
- **Flexible Execution**: Can be run from anywhere in the project folder

## Services Managed

1. **Backend** (Node.js) - Port 3001
2. **Frontend** (React/Vite) - Port 5173
3. **Recognizer** (Python) - Port 8001

## Quick Start

### Option 1: Windows Batch File (Recommended)
```cmd
start_service_manager.bat
```

### Option 2: PowerShell Script
```powershell
.\start_service_manager.ps1
```

### Option 3: Python Launcher
```cmd
python run_service_manager.py
```

### Option 4: Direct Execution
```cmd
cd python
python service_manager.py
```

## Command Line Options

```cmd
python service_manager.py [options]

Options:
  --no-ip-monitor    Disable IP monitoring functionality
  --start-only       Start services only, do not monitor
  --stop-only        Stop all services and exit
  --restart-only     Restart all services and exit
  -h, --help         Show help message
```

## Examples

### Start with IP monitoring (default)
```cmd
start_service_manager.bat
```

### Start without IP monitoring
```cmd
start_service_manager.bat --no-ip-monitor
```

### Start services and exit (no monitoring)
```cmd
start_service_manager.bat --start-only
```

### Stop all services
```cmd
start_service_manager.bat --stop-only
```

### Restart all services
```cmd
start_service_manager.bat --restart-only
```

## IP Monitoring Features

The integrated IP monitor automatically:

- Detects when your server's IP address changes
- Tests service connectivity at the new IP
- Updates frontend configuration files (.env and api.js)
- Creates backups before making changes
- Restarts the frontend when IP changes are detected

### Configuration Files Updated

- `frontend/.env` - Environment variables
- `frontend/src/config/api.js` - API endpoints

### Backup Files

Backups are stored in `ip_monitor_backups/` with timestamps:
- `.env_backup_YYYYMMDD_HHMMSS`
- `api.js_backup_YYYYMMDD_HHMMSS`

## Logging

All activities are logged to:
- Console output
- `service_manager.log` file

## Requirements

Make sure all dependencies are installed:

```cmd
cd python
pip install -r requirements.txt
```

## Troubleshooting

### Service Won't Start
1. Check if ports are available (3001, 5173, 8001)
2. Verify all dependencies are installed
3. Check the log files for specific error messages

### IP Monitoring Not Working
1. Ensure the recognizer service is running on port 8001
2. Check network connectivity
3. Verify frontend configuration files exist

### Virtual Environment Issues
1. Make sure the virtual environment is activated
2. Install dependencies: `pip install -r requirements.txt`

## File Structure

```
project_root/
├── python/
│   ├── service_manager.py      # Main service manager
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Virtual environment
├── frontend/
│   ├── .env                    # Environment config (auto-updated)
│   └── src/config/api.js       # API config (auto-updated)
├── backend/                    # Node.js backend
├── start_service_manager.bat   # Windows batch launcher
├── start_service_manager.ps1   # PowerShell launcher
├── run_service_manager.py      # Python launcher
└── ip_monitor_backups/         # Configuration backups
```

## Advanced Usage

### Custom Service Configuration

You can modify the service configurations in `service_manager.py`:

```python
self.services = {
    'backend': {
        'name': 'Node.js Backend',
        'command': f'cd "{self.project_root}\\backend" && npm start',
        'port': 3001,
        'process': None,
        'pid_file': str(self.project_root / 'backend.pid')
    },
    # ... other services
}
```

### Monitoring Intervals

- Service health check: Every 30 seconds
- IP monitoring check: Every 30 seconds (when enabled)

## Support

For issues or questions:
1. Check the log files for error messages
2. Verify all services are properly configured
3. Ensure all dependencies are installed
4. Check network connectivity for IP monitoring
