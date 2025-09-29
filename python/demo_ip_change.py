#!/usr/bin/env python3
"""
Demo script to show how the IP monitor handles IP changes
"""
import os
import time
from pathlib import Path

def show_current_config():
    """Show current configuration"""
    print("=== Current Configuration ===")
    
    # Show frontend .env
    env_file = Path("../frontend/.env")
    if env_file.exists():
        print("\nFrontend .env:")
        with open(env_file, 'r') as f:
            for line in f:
                if 'VITE_' in line and 'URL' in line:
                    print(f"  {line.strip()}")
    
    # Show api.js
    api_file = Path("../frontend/src/config/api.js")
    if api_file.exists():
        print("\nAPI Config (api.js):")
        with open(api_file, 'r') as f:
            lines = f.readlines()
            for i, line in enumerate(lines[1:8]):  # Show relevant lines
                if '192.168.0.4' in line:
                    print(f"  Line {i+2}: {line.strip()}")

def simulate_ip_change():
    """Simulate an IP change scenario"""
    print("\n=== Simulating IP Change ===")
    print("Current IP in config: 192.168.0.4")
    print("New IP would be: 192.168.1.100")
    print("\nThe IP monitor would:")
    print("1. Detect the IP change from 192.168.0.4 to 192.168.1.100")
    print("2. Test if the service is accessible at the new IP")
    print("3. Create backups of configuration files")
    print("4. Update frontend/.env file:")
    print("   - VITE_API_URL=https://192.168.1.100:5000")
    print("   - VITE_RECOGNITION_URL=https://192.168.1.100:8001")
    print("5. Update frontend/src/config/api.js:")
    print("   - baseUrl: 'https://192.168.1.100:8001'")
    print("   - API_BASE_URL = 'https://192.168.1.100:5000'")
    print("6. Log all operations in ip_monitor.log")

def show_network_info():
    """Show current network information"""
    print("\n=== Current Network Information ===")
    
    import subprocess
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
                        print(f"\n{current_interface}:")
                elif 'IPv4' in line and '.' in line and current_interface:
                    ip = line.split(':')[-1].strip()
                    if ip and current_interface:
                        print(f"  IPv4 Address: {ip}")
                        current_interface = None
    except Exception as e:
        print(f"Error getting network info: {e}")

def main():
    """Main demo function"""
    print("=== IP Monitor Demo ===")
    print("This demo shows how the IP monitor handles dynamic IP changes\n")
    
    show_current_config()
    show_network_info()
    simulate_ip_change()
    
    print("\n=== How to Use ===")
    print("1. Start IP monitoring: python ip_monitor.py")
    print("2. The monitor will check every 60 seconds for IP changes")
    print("3. When your IP changes, it will automatically update configs")
    print("4. Check ip_monitor.log for detailed logs")
    print("5. Use start_ip_monitor.bat for easy startup")

if __name__ == "__main__":
    main()
