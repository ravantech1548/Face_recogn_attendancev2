import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Alert,
  Chip,
  Grid,
  Divider,
  CircularProgress
} from '@mui/material'
import { RECOGNITION_SERVICE_CONFIG, getRecognitionUrl } from '../config/api'
import recognitionService from '../services/recognitionService'

export default function RecognitionConfig() {
  const [healthStatus, setHealthStatus] = useState(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)

  const checkHealth = async () => {
    setIsCheckingHealth(true)
    try {
      const result = await recognitionService.checkHealth()
      setHealthStatus(result)
      setLastCheck(new Date().toLocaleTimeString())
    } catch (error) {
      setHealthStatus({ success: false, error: error.message })
    } finally {
      setIsCheckingHealth(false)
    }
  }

  useEffect(() => {
    // Auto-check health on component mount
    checkHealth()
  }, [])

  const getStatusColor = (status) => {
    if (status === null) return 'default'
    if (status.success) return 'success'
    return 'error'
  }

  const getStatusText = (status) => {
    if (status === null) return 'Unknown'
    if (status.success) return 'Healthy'
    return 'Unhealthy'
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Face Recognition Service Configuration
        </Typography>

        <Grid container spacing={2}>
          {/* Configuration Details */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Service Configuration
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Base URL:</strong> {RECOGNITION_SERVICE_CONFIG.baseUrl}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Timeout:</strong> {RECOGNITION_SERVICE_CONFIG.timeout}ms
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>SSL Verify:</strong> {RECOGNITION_SERVICE_CONFIG.ssl.verify ? 'Yes' : 'No'}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Available Endpoints
            </Typography>
            
            {Object.entries(RECOGNITION_SERVICE_CONFIG.endpoints).map(([key, path]) => (
              <Box key={key} sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>{key}:</strong> {getRecognitionUrl(key)}
                </Typography>
              </Box>
            ))}
          </Grid>

          {/* Health Status */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Service Status
            </Typography>

            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label={getStatusText(healthStatus)} 
                color={getStatusColor(healthStatus)}
                size="small"
              />
              {isCheckingHealth && <CircularProgress size={16} />}
            </Box>

            {healthStatus && (
              <Box sx={{ mb: 2 }}>
                {healthStatus.success ? (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Service is running and accessible
                    {healthStatus.data && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Known faces: {healthStatus.data.known || 'Unknown'}
                      </Typography>
                    )}
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    Service is not accessible: {healthStatus.error}
                  </Alert>
                )}
              </Box>
            )}

            {lastCheck && (
              <Typography variant="caption" color="text.secondary">
                Last checked: {lastCheck}
              </Typography>
            )}

            <Box sx={{ mt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={checkHealth}
                disabled={isCheckingHealth}
                startIcon={isCheckingHealth ? <CircularProgress size={16} /> : null}
              >
                {isCheckingHealth ? 'Checking...' : 'Check Health'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Environment Variables Info */}
        <Typography variant="subtitle1" gutterBottom>
          Environment Configuration
        </Typography>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            To change the recognition service URL, create a <code>.env</code> file in the frontend directory with:
          </Typography>
          <Box component="pre" sx={{ mt: 1, fontSize: '0.875rem', backgroundColor: '#f5f5f5', p: 1, borderRadius: 1 }}>
{`VITE_RECOGNITION_URL=https://your-server:8001
VITE_RECOGNITION_TIMEOUT=30000
VITE_RECOGNITION_SSL_VERIFY=false`}
          </Box>
        </Alert>
      </CardContent>
    </Card>
  )
}
