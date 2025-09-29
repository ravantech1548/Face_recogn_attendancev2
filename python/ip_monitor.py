#!/usr/bin/env python3
"""
IP Address Monitor for Face Recognition Service
Automatically detects server IP changes and updates configuration files
"""
import os
import json
import time
import socket
import subprocess
import requests
from pathlib import Path
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ip_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IPMonitor:
    def __init__(self):
        self.current_ip = None
        self.last_ip = None
        # Update paths since we're now in python folder
        self.config_file = Path("../frontend/.env")
        self.api_config_file = Path("../frontend/src/config/api.js")
        self.backup_dir = Path("../ip_monitor_backups")
        self.backup_dir.mkdir(exist_ok=True)
        
        # Load last known IP
        self.load_last_ip()
        
    def get_local_ip(self):
        """Get the current local IP address"""
        try:
            # Connect to a remote server to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
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
                        # Focus on Wireless LAN and Ethernet adapters
                        if any(keyword in current_interface.lower() for keyword in ['wireless', 'wifi', 'ethernet', 'lan']):
                            interfaces[current_interface] = []
                        else:
                            current_interface = None  # Skip other adapters
                    elif 'IPv4' in line and '.' in line and current_interface:
                        ip = line.split(':')[-1].strip()
                        if ip and current_interface:
                            interfaces[current_interface].append(ip)
        except Exception as e:
            logger.error(f"Error getting network interfaces: {e}")
        return interfaces
    
    def load_last_ip(self):
        """Load the last known IP from file"""
        ip_file = Path("../last_known_ip.txt")
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
            with open("../last_known_ip.txt", 'w') as f:
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
                import shutil
                shutil.copy2(self.config_file, backup_file)
                logger.info(f"Backed up .env to {backup_file}")
            except Exception as e:
                logger.error(f"Error backing up .env: {e}")
        
        if self.api_config_file.exists():
            backup_file = self.backup_dir / f"api.js_backup_{timestamp}"
            try:
                import shutil
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
            # Read current .env file
            with open(self.config_file, 'r') as f:
                lines = f.readlines()
            
            # Update lines with new IP
            updated = False
            for i, line in enumerate(lines):
                # Look for VITE_RECOGNITION_URL and VITE_API_URL patterns
                if 'VITE_RECOGNITION_URL=' in line or 'VITE_API_URL=' in line:
                    # Extract the protocol and port
                    if '://' in line:
                        protocol_part = line.split('://')[0] + '://'
                        rest_part = line.split('://')[1]
                        if ':' in rest_part:
                            port_part = ':' + rest_part.split(':')[1].split()[0]  # Get port and any trailing content
                            lines[i] = f"{protocol_part}{new_ip}{port_part}\n"
                        else:
                            lines[i] = f"{protocol_part}{new_ip}\n"
                    else:
                        lines[i] = f"{line.split('=')[0]}={new_ip}\n"
                    updated = True
                    logger.info(f"Updated {line.split('=')[0]} to {new_ip}")
            
            # Write back to file
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
            # Read current API config
            with open(self.api_config_file, 'r') as f:
                content = f.read()
            
            # Update IP addresses in the file
            updated_content = content
            
            # Look for various IP patterns and update them
            import re
            
            # Pattern for URLs with IP addresses
            ip_pattern = r'\b(?:https?://)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?\b'
            
            def replace_ip(match):
                protocol = match.group(0).split('://')[0] if '://' in match.group(0) else ''
                port_part = match.group(0).split(':')[-1] if ':' in match.group(0) else ''
                
                if port_part and port_part.isdigit():
                    return f"{protocol}://{new_ip}:{port_part}" if protocol else f"{new_ip}:{port_part}"
                else:
                    return f"{protocol}://{new_ip}" if protocol else new_ip
            
            updated_content = re.sub(ip_pattern, replace_ip, updated_content)
            
            # Write back to file
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
            # Try HTTP first
            response = requests.get(f"http://{ip}:{port}/health", timeout=5)
            if response.status_code == 200:
                logger.info(f"Service accessible via HTTP at {ip}:{port}")
                return True
        except:
            pass
        
        try:
            # Try HTTPS
            response = requests.get(f"https://{ip}:{port}/health", timeout=5, verify=False)
            if response.status_code == 200:
                logger.info(f"Service accessible via HTTPS at {ip}:{port}")
                return True
        except:
            pass
        
        return False
    
    def find_working_ip(self):
        """Find the IP address where the service is actually running"""
        # Get all possible IPs
        interfaces = self.get_network_interfaces()
        all_ips = []
        
        for interface, ips in interfaces.items():
            all_ips.extend(ips)
        
        # Remove duplicates and localhost
        all_ips = list(set(all_ips))
        all_ips = [ip for ip in all_ips if ip not in ['127.0.0.1', '::1']]
        
        logger.info(f"Testing IPs: {all_ips}")
        
        # Test each IP
        for ip in all_ips:
            if self.test_service_connection(ip):
                logger.info(f"Found working service at IP: {ip}")
                return ip
        
        return None
    
    def monitor_and_update(self):
        """Main monitoring loop"""
        logger.info("Starting IP monitoring...")
        
        while True:
            try:
                # Get current IP
                self.current_ip = self.get_local_ip()
                
                if not self.current_ip:
                    logger.error("Could not determine current IP")
                    time.sleep(30)
                    continue
                
                # Check if IP has changed
                if self.current_ip != self.last_ip:
                    logger.info(f"IP changed from {self.last_ip} to {self.current_ip}")
                    
                    # Test if service is accessible at new IP
                    if self.test_service_connection(self.current_ip):
                        logger.info("Service is accessible at new IP")
                        
                        # Backup current configs
                        self.backup_config_files()
                        
                        # Update configuration files
                        env_updated = self.update_env_file(self.current_ip)
                        api_updated = self.update_api_config(self.current_ip)
                        
                        if env_updated or api_updated:
                            logger.info("Configuration files updated successfully")
                            self.save_last_ip(self.current_ip)
                        else:
                            logger.warning("No configuration files were updated")
                    else:
                        logger.warning(f"Service not accessible at new IP {self.current_ip}")
                        
                        # Try to find where the service is actually running
                        working_ip = self.find_working_ip()
                        if working_ip and working_ip != self.last_ip:
                            logger.info(f"Service found at different IP: {working_ip}")
                            
                            # Backup and update configs
                            self.backup_config_files()
                            self.update_env_file(working_ip)
                            self.update_api_config(working_ip)
                            self.save_last_ip(working_ip)
                else:
                    # IP hasn't changed, but let's verify service is still accessible
                    if not self.test_service_connection(self.current_ip):
                        logger.warning(f"Service not accessible at current IP {self.current_ip}")
                        
                        # Try to find working IP
                        working_ip = self.find_working_ip()
                        if working_ip and working_ip != self.current_ip:
                            logger.info(f"Found service at different IP: {working_ip}")
                            
                            # Update configs
                            self.backup_config_files()
                            self.update_env_file(working_ip)
                            self.update_api_config(working_ip)
                            self.save_last_ip(working_ip)
                            self.current_ip = working_ip
                
                # Wait before next check
                time.sleep(60)  # Check every minute
                
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(30)

def main():
    """Main function"""
    print("=== IP Address Monitor for Face Recognition Service ===")
    print("This program will monitor your server's IP address and automatically")
    print("update configuration files when the IP changes.")
    print("Press Ctrl+C to stop monitoring.")
    print()
    
    monitor = IPMonitor()
    
    try:
        monitor.monitor_and_update()
    except KeyboardInterrupt:
        print("\nMonitoring stopped.")
    except Exception as e:
        logger.error(f"Fatal error: {e}")

if __name__ == "__main__":
    main()
