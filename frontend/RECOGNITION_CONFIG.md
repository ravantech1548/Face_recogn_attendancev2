# Face Recognition Service Configuration

This document explains how to configure the face recognition service URLs and settings for the frontend application.

## Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```bash
# Backend API Configuration
VITE_API_URL=https://192.168.1.9:5000

# Face Recognition Service Configuration
VITE_RECOGNITION_URL=https://192.168.1.9:8001
VITE_RECOGNITION_TIMEOUT=30000
VITE_RECOGNITION_SSL_VERIFY=false

# Development Configuration
VITE_DEV_MODE=true
VITE_DEBUG_RECOGNITION=false
```

## Configuration Options

### VITE_RECOGNITION_URL
- **Description**: Base URL for the face recognition service
- **Default**: `https://192.168.1.9:8001`
- **Example**: `https://localhost:8001` or `https://192.168.1.100:8001`

### VITE_RECOGNITION_TIMEOUT
- **Description**: Request timeout in milliseconds
- **Default**: `30000` (30 seconds)
- **Example**: `60000` for 60 seconds

### VITE_RECOGNITION_SSL_VERIFY
- **Description**: Whether to verify SSL certificates
- **Default**: `false` (for development with self-signed certificates)
- **Example**: `true` for production with valid certificates

## Available Endpoints

The following endpoints are automatically configured:

- `/health` - Health check endpoint
- `/recognize` - Full face recognition with liveness detection
- `/recognize-simple` - Simple face recognition without liveness
- `/liveness-check` - Liveness detection only
- `/reload` - Reload face database

## Usage in Components

```javascript
import { getRecognitionUrl, getRecognitionConfig } from '../config/api'

// Get URL for specific endpoint
const healthUrl = getRecognitionUrl('health')
const recognizeUrl = getRecognitionUrl('recognize')

// Get request configuration
const config = getRecognitionConfig()

// Make request
const response = await fetch(recognizeUrl, {
  method: 'POST',
  body: formData,
  ...config
})
```

## Troubleshooting

### Service Not Running
If you get "Network error: Unable to connect to recognition service", check:
1. Python recognition service is running: `python recognizer_service.py`
2. Service is accessible on the configured URL
3. Firewall allows connections on the configured port

### SSL Certificate Issues
If you get SSL errors:
1. Set `VITE_RECOGNITION_SSL_VERIFY=false` for development
2. Use HTTP instead of HTTPS for local development
3. Install proper SSL certificates for production

### Timeout Issues
If requests timeout:
1. Increase `VITE_RECOGNITION_TIMEOUT` value
2. Check network connectivity
3. Verify the recognition service is responding quickly
