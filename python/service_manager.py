#!/usr/bin/env python3
"""
Service Manager for Face Recognition System
Manages IP monitoring and automatic service restarts
"""
import os
import sys
import time
import subprocess
import signal
import psutil
from pathlib import Path
import logging
from datetime import datetime
import threading
import socket
import requests
import json
import re
import shutil

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('service_manager.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IPMonitor:
    def __init__(self, project_root):
        self.project_root = project_root
        self.current_ip = None
        self.last_ip = None
        self.config_file = project_root / "frontend" / ".env"
        self.api_config_file = project_root / "frontend" / "src" / "config" / "api.js"
        self.backup_dir = project_root / "ip_monitor_backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        # Load last known IP
        self.load_last_ip()
        
    def get_local_ip(self):
        """Get the current local IP address from network adapters"""
        try:
            # First try to get IP from network adapters (Ethernet/WiFi)
            interfaces = self.get_network_interfaces()
            all_ips = []
            
            for interface, ips in interfaces.items():
                all_ips.extend(ips)
            
            # Remove duplicates and localhost
            all_ips = list(set(all_ips))
            all_ips = [ip for ip in all_ips if ip not in ['127.0.0.1', '::1']]
            
            if all_ips:
                # Prioritize local network IPs over VPN IPs
                local_ips = [ip for ip in all_ips if not ip.startswith('100.') and not ip.startswith('10.')]
                if local_ips:
                    # Prefer 192.168.x.x and 172.16-31.x.x ranges (local network)
                    preferred_ips = [ip for ip in local_ips if ip.startswith('192.168.') or ip.startswith('172.')]
                    if preferred_ips:
                        selected_ip = preferred_ips[0]
                        logger.info(f"Selected local network IP: {selected_ip} from {all_ips}")
                        return selected_ip
                    else:
                        selected_ip = local_ips[0]
                        logger.info(f"Selected non-VPN IP: {selected_ip} from {all_ips}")
                        return selected_ip
                else:
                    # Fallback to any available IP
                    selected_ip = all_ips[0]
                    logger.info(f"Selected IP: {selected_ip} from {all_ips}")
                    return selected_ip
            
            # Fallback to socket method
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
            logger.info(f"Using socket method IP: {local_ip}")
            return local_ip
        except Exception as e:
            logger.error(f"Error getting local IP: {e}")
            return None
    
    def get_network_interfaces(self):
        """Get all network interfaces and their IPs, focusing on Wireless LAN and Ethernet"""
        interfaces = {}
        try:
            result = subprocess.run(['ipconfig'], capture_output=True, text=True, shell=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                current_interface = None
                for line in lines:
                    line = line.strip()
                    if 'adapter' in line.lower() and ':' in line:
                        current_interface = line.replace(':', '').strip()
                        # Include more network adapter types
                        if any(keyword in current_interface.lower() for keyword in [
                            'wireless', 'wifi', 'ethernet', 'lan', 'local area connection',
                            'wi-fi', 'wlan', 'network', 'adapter'
                        ]):
                            interfaces[current_interface] = []
                            logger.debug(f"Found network adapter: {current_interface}")
                        else:
                            current_interface = None
                    elif 'IPv4' in line and '.' in line and current_interface:
                        ip = line.split(':')[-1].strip()
                        if ip and current_interface and not ip.startswith('169.254'):  # Skip APIPA addresses
                            interfaces[current_interface].append(ip)
                            logger.debug(f"Found IP {ip} for {current_interface}")
        except Exception as e:
            logger.error(f"Error getting network interfaces: {e}")
        return interfaces
    
    def load_last_ip(self):
        """Load the last known IP from file"""
        ip_file = self.project_root / "last_known_ip.txt"
        if ip_file.exists():
            try:
                with open(ip_file, 'r') as f:
                    self.last_ip = f.read().strip()
                logger.info(f"Loaded last known IP: {self.last_ip}")
            except Exception as e:
                logger.error(f"Error loading last IP: {e}")
    
    def save_last_ip(self, ip):
        """Save the current IP to file"""
        try:
            with open(self.project_root / "last_known_ip.txt", 'w') as f:
                f.write(ip)
            self.last_ip = ip
            logger.info(f"Saved IP: {ip}")
        except Exception as e:
            logger.error(f"Error saving IP: {e}")
    
    def backup_config_files(self):
        """Create backup of configuration files before modifying"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if self.config_file.exists():
            backup_file = self.backup_dir / f".env_backup_{timestamp}"
            try:
                shutil.copy2(self.config_file, backup_file)
                logger.info(f"Backed up .env to {backup_file}")
            except Exception as e:
                logger.error(f"Error backing up .env: {e}")
        
        if self.api_config_file.exists():
            backup_file = self.backup_dir / f"api.js_backup_{timestamp}"
            try:
                shutil.copy2(self.api_config_file, backup_file)
                logger.info(f"Backed up api.js to {backup_file}")
            except Exception as e:
                logger.error(f"Error backing up api.js: {e}")
    
    def update_env_file(self, new_ip):
        """Update frontend/.env file with new IP"""
        if not self.config_file.exists():
            logger.warning("Frontend .env file not found")
            return False
        
        try:
            with open(self.config_file, 'r') as f:
                lines = f.readlines()
            
            updated = False
            for i, line in enumerate(lines):
                if 'VITE_RECOGNITION_URL=' in line or 'VITE_API_URL=' in line:
                    if '://' in line:
                        protocol_part = line.split('://')[0] + '://'
                        rest_part = line.split('://')[1]
                        if ':' in rest_part:
                            port_part = ':' + rest_part.split(':')[1].split()[0]
                            lines[i] = f"{protocol_part}{new_ip}{port_part}\n"
                        else:
                            lines[i] = f"{protocol_part}{new_ip}\n"
                    else:
                        lines[i] = f"{line.split('=')[0]}={new_ip}\n"
                    updated = True
                    logger.info(f"Updated {line.split('=')[0]} to {new_ip}")
            
            if updated:
                with open(self.config_file, 'w') as f:
                    f.writelines(lines)
                logger.info("Updated frontend/.env file successfully")
                return True
            else:
                logger.warning("No IP configurations found in frontend/.env file")
                return False
                
        except Exception as e:
            logger.error(f"Error updating frontend/.env file: {e}")
            return False
    
    def update_api_config(self, new_ip):
        """Update frontend API configuration with new IP"""
        if not self.api_config_file.exists():
            logger.warning("API config file not found")
            return False
        
        try:
            with open(self.api_config_file, 'r') as f:
                content = f.read()
            
            updated_content = content
            ip_pattern = r'\b(?:https?://)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?\b'
            
            def replace_ip(match):
                protocol = match.group(0).split('://')[0] if '://' in match.group(0) else ''
                port_part = match.group(0).split(':')[-1] if ':' in match.group(0) else ''
                
                if port_part and port_part.isdigit():
                    return f"{protocol}://{new_ip}:{port_part}" if protocol else f"{new_ip}:{port_part}"
                else:
                    return f"{protocol}://{new_ip}" if protocol else new_ip
            
            updated_content = re.sub(ip_pattern, replace_ip, updated_content)
            
            if updated_content != content:
                with open(self.api_config_file, 'w') as f:
                    f.write(updated_content)
                logger.info("Updated API config file successfully")
                return True
            else:
                logger.info("No IP addresses found to update in API config")
                return False
                
        except Exception as e:
            logger.error(f"Error updating API config: {e}")
            return False
    
    def test_service_connection(self, ip, port=8001):
        """Test if the service is accessible at the given IP"""
        try:
            response = requests.get(f"http://{ip}:{port}/health", timeout=5)
            if response.status_code == 200:
                logger.info(f"Service accessible via HTTP at {ip}:{port}")
                return True
        except:
            pass
        
        try:
            response = requests.get(f"https://{ip}:{port}/health", timeout=5, verify=False)
            if response.status_code == 200:
                logger.info(f"Service accessible via HTTPS at {ip}:{port}")
                return True
        except:
            pass
        
        return False
    
    def find_working_ip(self):
        """Find the IP address where the service is actually running"""
        interfaces = self.get_network_interfaces()
        all_ips = []
        
        for interface, ips in interfaces.items():
            all_ips.extend(ips)
        
        all_ips = list(set(all_ips))
        all_ips = [ip for ip in all_ips if ip not in ['127.0.0.1', '::1']]
        
        logger.info(f"Testing IPs: {all_ips}")
        
        for ip in all_ips:
            if self.test_service_connection(ip):
                logger.info(f"Found working service at IP: {ip}")
                return ip
        
        return None
    
    def check_and_update_ip(self):
        """Check for IP changes and update configuration if needed"""
        try:
            self.current_ip = self.get_local_ip()
            
            if not self.current_ip:
                logger.error("Could not determine current IP")
                return False
            
            if self.current_ip != self.last_ip:
                logger.info(f"IP changed from {self.last_ip} to {self.current_ip}")
                
                if self.test_service_connection(self.current_ip):
                    logger.info("Service is accessible at new IP")
                    
                    self.backup_config_files()
                    
                    env_updated = self.update_env_file(self.current_ip)
                    api_updated = self.update_api_config(self.current_ip)
                    
                    if env_updated or api_updated:
                        logger.info("Configuration files updated successfully")
                        self.save_last_ip(self.current_ip)
                        return True
                    else:
                        logger.warning("No configuration files were updated")
                else:
                    logger.warning(f"Service not accessible at new IP {self.current_ip}")
                    
                    working_ip = self.find_working_ip()
                    if working_ip and working_ip != self.last_ip:
                        logger.info(f"Service found at different IP: {working_ip}")
                        
                        self.backup_config_files()
                        self.update_env_file(working_ip)
                        self.update_api_config(working_ip)
                        self.save_last_ip(working_ip)
                        self.current_ip = working_ip
                        return True
            else:
                if not self.test_service_connection(self.current_ip):
                    logger.warning(f"Service not accessible at current IP {self.current_ip}")
                    
                    working_ip = self.find_working_ip()
                    if working_ip and working_ip != self.current_ip:
                        logger.info(f"Found service at different IP: {working_ip}")
                        
                        self.backup_config_files()
                        self.update_env_file(working_ip)
                        self.update_api_config(working_ip)
                        self.save_last_ip(working_ip)
                        self.current_ip = working_ip
                        return True
            
            return False
                
        except Exception as e:
            logger.error(f"Error in IP monitoring: {e}")
            return False

class ServiceManager:
    def __init__(self, enable_ip_monitoring=True):
        # Get the parent directory (project root) from the python folder
        self.project_root = Path(__file__).parent.parent
        
        # Initialize IP monitor
        self.ip_monitor = IPMonitor(self.project_root) if enable_ip_monitoring else None
        
        self.services = {
            'backend': {
                'name': 'Node.js Backend',
                'command': f'cd "{self.project_root}\\backend" && npm start',
                'port': 5000,
                'process': None,
                'pid_file': str(self.project_root / 'backend.pid')
            },
            'frontend': {
                'name': 'React Frontend',
                'command': f'cd "{self.project_root}\\frontend" && npm run dev',
                'port': 5173,
                'process': None,
                'pid_file': str(self.project_root / 'frontend.pid')
            },
            'recognizer': {
                'name': 'Python Recognition Service',
                'command': f'cd "{self.project_root}\\python" && .\\venv\\Scripts\\activate && python start_https_production.py',
                'port': 8001,
                'process': None,
                'pid_file': str(self.project_root / 'recognizer.pid')
            }
        }
        self.running = False
        
    def is_service_running(self, service_name):
        """Check if a service is running"""
        service = self.services[service_name]
        
        # Check PID file
        pid_file = Path(service['pid_file'])
        if pid_file.exists():
            try:
                with open(pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                # Check if process is actually running
                if psutil.pid_exists(pid):
                    try:
                        process = psutil.Process(pid)
                        # More flexible process name checking
                        process_name = process.name().lower()
                        if service_name == 'backend' and 'node' in process_name:
                            logger.debug(f"{service['name']} is running (PID: {pid}, Name: {process_name})")
                            return True
                        elif service_name == 'frontend' and ('vite' in process_name or 'node' in process_name):
                            logger.debug(f"{service['name']} is running (PID: {pid}, Name: {process_name})")
                            return True
                        elif service_name == 'recognizer' and 'python' in process_name:
                            logger.debug(f"{service['name']} is running (PID: {pid}, Name: {process_name})")
                            return True
                    except Exception as e:
                        logger.debug(f"Error checking process {pid}: {e}")
                
                # Clean up stale PID file
                logger.debug(f"Cleaning up stale PID file for {service['name']}")
                pid_file.unlink()
            except Exception as e:
                logger.debug(f"Error reading PID file for {service['name']}: {e}")
        
        logger.debug(f"{service['name']} is not running")
        return False
    
    def check_frontend_connectivity(self):
        """Check if frontend can connect to backend services"""
        try:
            # Test backend connection
            backend_response = requests.get(f"http://127.0.0.1:5000/api/health", timeout=5)
            if backend_response.status_code != 200:
                logger.warning("Frontend cannot connect to backend")
                return False
            
            # Test recognizer connection
            recognizer_response = requests.get(f"https://127.0.0.1:8001/health", timeout=5, verify=False)
            if recognizer_response.status_code != 200:
                logger.warning("Frontend cannot connect to recognizer service")
                return False
            
            return True
        except Exception as e:
            logger.warning(f"Frontend connectivity check failed: {e}")
            return False
    
    def start_service(self, service_name):
        """Start a specific service"""
        service = self.services[service_name]
        
        if self.is_service_running(service_name):
            logger.info(f"{service['name']} is already running")
            return True
        
        try:
            logger.info(f"Starting {service['name']}...")
            
            # Start the service
            if os.name == 'nt':  # Windows
                process = subprocess.Popen(
                    service['command'],
                    shell=True,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
                    cwd=self.project_root
                )
            else:  # Unix-like
                process = subprocess.Popen(
                    service['command'],
                    shell=True,
                    preexec_fn=os.setsid,
                    cwd=self.project_root
                )
            
            service['process'] = process
            logger.info(f"{service['name']} started with shell PID {process.pid}")
            
            # Wait a bit to see if it starts successfully
            time.sleep(5)
            
            if process.poll() is None:  # Still running
                # Find the actual service process (not the shell)
                actual_pid = self.find_service_process(service_name, process.pid)
                if actual_pid:
                    # Save the actual service PID
                    with open(service['pid_file'], 'w') as f:
                        f.write(str(actual_pid))
                    logger.info(f"{service['name']} actual PID: {actual_pid}")
                else:
                    # Fallback to shell PID
                    with open(service['pid_file'], 'w') as f:
                        f.write(str(process.pid))
                    logger.warning(f"Could not find actual service process, using shell PID: {process.pid}")
                
                logger.info(f"{service['name']} started successfully")
                return True
            else:
                logger.error(f"{service['name']} failed to start")
                return False
                
        except Exception as e:
            logger.error(f"Error starting {service['name']}: {e}")
            return False
    
    def find_service_process(self, service_name, parent_pid):
        """Find the actual service process spawned by the shell"""
        try:
            parent = psutil.Process(parent_pid)
            children = parent.children(recursive=True)
            
            for child in children:
                try:
                    name = child.name().lower()
                    if service_name == 'backend' and 'node' in name:
                        return child.pid
                    elif service_name == 'frontend' and ('vite' in name or 'node' in name):
                        return child.pid
                    elif service_name == 'recognizer' and 'python' in name:
                        return child.pid
                except:
                    continue
        except:
            pass
        return None
    
    def stop_service(self, service_name):
        """Stop a specific service"""
        service = self.services[service_name]
        
        try:
            # Try to stop using PID file
            pid_file = Path(service['pid_file'])
            if pid_file.exists():
                with open(pid_file, 'r') as f:
                    pid = int(f.read().strip())
                
                if psutil.pid_exists(pid):
                    process = psutil.Process(pid)
                    process.terminate()
                    
                    # Wait for graceful shutdown
                    try:
                        process.wait(timeout=10)
                    except psutil.TimeoutExpired:
                        process.kill()
                    
                    logger.info(f"{service['name']} stopped")
                
                pid_file.unlink()
            
            # Also try to kill by process name and port
            for proc in psutil.process_iter(['pid', 'name', 'connections']):
                try:
                    # Check if process is using the service port
                    for conn in proc.connections():
                        if hasattr(conn, 'laddr') and conn.laddr.port == service['port']:
                            proc.terminate()
                            logger.info(f"Stopped process using port {service['port']}")
                            break
                except:
                    pass
            
            # Additional cleanup: kill any remaining processes on the port
            try:
                if os.name == 'nt':  # Windows
                    # Find processes using the port
                    result = subprocess.run(f'netstat -ano | findstr :{service["port"]}', shell=True, capture_output=True, text=True)
                    if result.stdout:
                        lines = result.stdout.strip().split('\n')
                        for line in lines:
                            if f':{service["port"]}' in line:
                                parts = line.split()
                                if len(parts) >= 5:
                                    pid = parts[-1]
                                    try:
                                        subprocess.run(f'taskkill /f /pid {pid}', shell=True, capture_output=True)
                                        logger.info(f"Killed process {pid} using port {service['port']}")
                                    except:
                                        pass
            except Exception as e:
                logger.debug(f"Port cleanup error: {e}")
                    
        except Exception as e:
            logger.error(f"Error stopping {service['name']}: {e}")
    
    def restart_service(self, service_name):
        """Restart a specific service"""
        service = self.services[service_name]
        logger.info(f"Restarting {service['name']}...")
        self.stop_service(service_name)
        time.sleep(3)  # Increased delay to ensure port is released
        return self.start_service(service_name)
    
    def start_all_services(self):
        """Start all services"""
        logger.info("Starting all services...")
        
        # Start in order: backend, recognizer, frontend
        start_order = ['backend', 'recognizer', 'frontend']
        
        for service_name in start_order:
            if not self.start_service(service_name):
                logger.error(f"Failed to start {service_name}")
                return False
        
        logger.info("All services started successfully")
        return True
    
    def stop_all_services(self):
        """Stop all services"""
        logger.info("Stopping all services...")
        
        # Stop in reverse order
        stop_order = ['frontend', 'recognizer', 'backend']
        
        for service_name in stop_order:
            self.stop_service(service_name)
        
        logger.info("All services stopped")
    
    def monitor_services(self):
        """Monitor services and restart if needed"""
        logger.info("Starting service monitoring...")
        
        while self.running:
            try:
                # Check services
                for service_name, service in self.services.items():
                    is_running = self.is_service_running(service_name)
                    logger.debug(f"Service {service['name']} running status: {is_running}")
                    
                    if not is_running:
                        logger.warning(f"{service['name']} is not running, attempting to restart...")
                        
                        # If frontend fails, check for IP changes before restarting
                        if service_name == 'frontend' and self.ip_monitor:
                            logger.info("Frontend failed, checking for IP changes...")
                            try:
                                if self.ip_monitor.check_and_update_ip():
                                    logger.info("IP configuration updated due to frontend failure")
                            except Exception as e:
                                logger.error(f"Error checking IP during frontend failure: {e}")
                        
                        if not self.restart_service(service_name):
                            logger.error(f"Failed to restart {service['name']}")
                    else:
                        # Service is running, but check frontend connectivity if IP monitoring is enabled
                        if service_name == 'frontend' and self.ip_monitor:
                            if not self.check_frontend_connectivity():
                                logger.warning("Frontend is running but cannot connect to backend services")
                                logger.info("Checking for IP changes...")
                                try:
                                    if self.ip_monitor.check_and_update_ip():
                                        logger.info("IP configuration updated, restarting frontend...")
                                        self.restart_service(service_name)
                                except Exception as e:
                                    logger.error(f"Error checking IP during connectivity issue: {e}")
                
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in service monitoring: {e}")
                time.sleep(30)
    
    def run(self):
        """Main run method"""
        self.running = True
        
        # Handle shutdown gracefully
        def signal_handler(sig, frame):
            logger.info("Shutting down service manager...")
            self.running = False
            self.stop_all_services()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            # Start all services
            if not self.start_all_services():
                logger.error("Failed to start all services")
                return
            
            # Start monitoring in a separate thread
            monitor_thread = threading.Thread(target=self.monitor_services)
            monitor_thread.daemon = True
            monitor_thread.start()
            
            # Keep main thread alive
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Service manager stopped by user")
        finally:
            self.stop_all_services()

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Face Recognition System Service Manager')
    parser.add_argument('--no-ip-monitor', action='store_true', 
                       help='Disable IP monitoring functionality')
    parser.add_argument('--start-only', action='store_true',
                       help='Start services only, do not monitor')
    parser.add_argument('--stop-only', action='store_true',
                       help='Stop all services and exit')
    parser.add_argument('--restart-only', action='store_true',
                       help='Restart all services and exit')
    
    args = parser.parse_args()
    
    print("=== Face Recognition System Service Manager ===")
    if not args.no_ip_monitor:
        print("Features: Service management + IP monitoring (triggered on connection failures)")
    else:
        print("Features: Service management only")
    print("Press Ctrl+C to stop all services.")
    print()
    
    manager = ServiceManager(enable_ip_monitoring=not args.no_ip_monitor)
    
    try:
        if args.stop_only:
            print("Stopping all services...")
            manager.stop_all_services()
            print("All services stopped.")
            return
        elif args.restart_only:
            print("Restarting all services...")
            manager.stop_all_services()
            time.sleep(2)
            if manager.start_all_services():
                print("All services restarted successfully.")
            else:
                print("Failed to restart all services.")
            return
        elif args.start_only:
            print("Starting all services...")
            if manager.start_all_services():
                print("All services started successfully.")
            else:
                print("Failed to start all services.")
            return
        else:
            manager.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")

if __name__ == "__main__":
    main()
