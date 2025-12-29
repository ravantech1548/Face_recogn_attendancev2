// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://192.168.0.17:5000'

// Face Recognition Service Configuration
const RECOGNITION_SERVICE_CONFIG = {
  // Base URL for the face recognition service
  baseUrl: import.meta.env.VITE_RECOGNITION_URL || 'https://192.168.0.17:8001',
  
  // Individual endpoint paths
  endpoints: {
    health: '/health',
    recognize: '/recognize',
    recognizeSimple: '/recognize-simple',
    livenessCheck: '/liveness-check',
    reload: '/reload'
  },
  
  // Request timeout in milliseconds (increased to 60s for slow face recognition)
  timeout: parseInt(import.meta.env.VITE_RECOGNITION_TIMEOUT) || 60000,
  
  // SSL/TLS configuration
  ssl: {
    verify: import.meta.env.VITE_RECOGNITION_SSL_VERIFY !== 'false'
  }
}

// Helper function to get full URL for an endpoint
const getRecognitionUrl = (endpoint) => {
  const path = RECOGNITION_SERVICE_CONFIG.endpoints[endpoint]
  if (!path) {
    throw new Error(`Unknown endpoint: ${endpoint}`)
  }
  return `${RECOGNITION_SERVICE_CONFIG.baseUrl}${path}`
}

// Helper function to get request configuration
const getRecognitionConfig = () => ({
  timeout: RECOGNITION_SERVICE_CONFIG.timeout,
  verify: RECOGNITION_SERVICE_CONFIG.ssl.verify
})

export default API_BASE_URL
export { 
  RECOGNITION_SERVICE_CONFIG,
  getRecognitionUrl,
  getRecognitionConfig
}
