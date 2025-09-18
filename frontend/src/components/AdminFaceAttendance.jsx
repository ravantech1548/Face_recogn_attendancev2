import React, { useEffect, useRef, useState } from 'react'
import { 
  Container, 
  Paper, 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Alert, 
  LinearProgress,
  Chip,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Switch,
  FormControlLabel,
  CircularProgress,
  Backdrop,
  Fade
} from '@mui/material'
import { useAuth } from '../context/AuthContext'
import API_BASE_URL, { getRecognitionUrl, getRecognitionConfig } from '../config/api'

export default function AdminFaceAttendance() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const intervalRef = useRef(null)
  
  const [error, setError] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [livenessMode, setLivenessMode] = useState(false)
  const [capturedFrames, setCapturedFrames] = useState([])
  const [livenessStatus, setLivenessStatus] = useState({
    blinking_detected: false,
    head_movement_detected: false,
    face_quality: {}
  })
  const [activeStep, setActiveStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [livenessDetectionEnabled, setLivenessDetectionEnabled] = useState(false)
  const [isRecognitionLoading, setIsRecognitionLoading] = useState(false)
  const [isUploadLoading, setIsUploadLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [showLoadingBackdrop, setShowLoadingBackdrop] = useState(false)

  const getSteps = () => {
    if (livenessDetectionEnabled) {
      return [
        'Start Camera',
        'Capture Multiple Frames',
        'Liveness Detection',
        'Face Recognition',
        'Attendance Marked'
      ]
    } else {
      return [
        'Start Camera',
        'Capture Face',
        'Face Recognition',
        'Attendance Marked'
      ]
    }
  }

  useEffect(() => {
    return () => {
      stopStream()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  async function startStream() {
    setError('')
    setActiveStep(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreaming(true)
        setActiveStep(1)
      }
    } catch (e) {
      setError('Unable to access camera')
    }
  }

  function stopStream() {
    setStreaming(false)
    setLivenessMode(false)
    setCapturedFrames([])
    setActiveStep(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }

  async function startLivenessDetection() {
    if (!livenessDetectionEnabled) {
      // Simple face recognition mode
      setActiveStep(1)
      await captureAndRecognize()
      return
    }

    setLivenessMode(true)
    setCapturedFrames([])
    setActiveStep(2)
    
    // Capture frames every 500ms for 3 seconds (6 frames)
    let frameCount = 0
    const maxFrames = 6
    
    intervalRef.current = setInterval(async () => {
      await captureFrame()
      frameCount++
      
      if (frameCount >= maxFrames) {
        clearInterval(intervalRef.current)
        // Wait a bit more to ensure all frames are captured
        setTimeout(async () => {
          await processLivenessDetection()
        }, 200)
        return
      }
    }, 500)
  }

  async function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Ensure video is ready and has valid dimensions
    if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video not ready or invalid dimensions, skipping frame')
      return
    }
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    // Clear canvas and draw video frame
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Capture with higher quality
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    
    if (blob && blob.size > 0) {
      setCapturedFrames(prev => {
        const newFrames = [...prev, blob]
        console.log(`Captured frame ${newFrames.length}/6 (${blob.size} bytes)`)
        return newFrames
      })
    } else {
      console.log('Failed to capture valid frame')
    }
  }

  async function processLivenessDetection() {
    console.log(`Processing liveness detection with ${capturedFrames.length} frames`)
    
    if (capturedFrames.length < 2) {
      setError(`Not enough frames captured for liveness detection. Got ${capturedFrames.length}, need at least 2.`)
      setLivenessMode(false)
      return
    }

    setIsProcessing(true)
    setIsRecognitionLoading(true)
    setLoadingMessage('Analyzing face for liveness detection...')
    setShowLoadingBackdrop(true)
    setActiveStep(3)

    try {
      const formData = new FormData()
      capturedFrames.forEach((blob, index) => {
        formData.append('images', blob, `frame_${index}.jpg`)
      })

      const livenessUrl = getRecognitionUrl('livenessCheck')
      const config = getRecognitionConfig()
      
      console.log('Sending liveness check request...')
      console.log('Request URL:', livenessUrl)
      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value.name || value.size || 'blob']))
      
      const res = await fetch(livenessUrl, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout)
      })
      
      console.log('Liveness check response status:', res.status)
      console.log('Liveness check response headers:', res.headers)
      
      let data
      try {
        const responseText = await res.text()
        console.log('Raw response:', responseText)
        data = JSON.parse(responseText)
        console.log('Parsed response:', data)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        setError('Invalid response from liveness service: ' + parseError.message)
        setLivenessMode(false)
        return
      }
      
      if (res.ok && data.liveness_passed) {
        setLivenessStatus(data.liveness_details)
        setLoadingMessage('Performing face recognition...')
        await performFaceRecognition()
      } else {
        setError('Liveness check failed: ' + (data.message || 'Unknown error'))
        setLivenessStatus(data.liveness_details || {})
        setLivenessMode(false)
        setIsRecognitionLoading(false)
        setShowLoadingBackdrop(false)
      }
    } catch (e) {
      console.error('Liveness detection error:', e)
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setError('Network error: Unable to connect to recognition service. Please check if the service is running.')
      } else {
        setError('Liveness detection request failed: ' + e.message)
      }
      setLivenessMode(false)
      setIsRecognitionLoading(false)
      setShowLoadingBackdrop(false)
    } finally {
      setIsProcessing(false)
    }
  }

  async function performFaceRecognition() {
    try {
      const formData = new FormData()
      capturedFrames.forEach((blob, index) => {
        formData.append('images', blob, `frame_${index}.jpg`)
      })

      const recognizeUrl = getRecognitionUrl('recognize')
      const config = getRecognitionConfig()
      
      console.log('Sending face recognition request...')
      console.log('Request URL:', recognizeUrl)
      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value.name || value.size || 'blob']))
      
      const res = await fetch(recognizeUrl, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout)
      })
      
      let data
      try {
        const responseText = await res.text()
        console.log('Face recognition raw response:', responseText)
        data = JSON.parse(responseText)
        console.log('Face recognition parsed response:', data)
      } catch (parseError) {
        console.error('Face recognition JSON parse error:', parseError)
        setError('Invalid response from recognition service: ' + parseError.message)
        setLivenessMode(false)
        return
      }
      
      setLastResult(data)

      // If a confident match was found, mark attendance via backend
      const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
      if (best?.staffId) {
        setLoadingMessage('Recording attendance...')
        setActiveStep(4)
        try {
          const token = localStorage.getItem('token')
          
          // Create FormData to send face image and data
          const formData = new FormData()
          formData.append('staffId', best.staffId)
          formData.append('confidenceScore', best.score || 0)
          
          // Add the first captured frame as the face image
          if (capturedFrames.length > 0) {
            formData.append('faceImage', capturedFrames[0], 'face_capture.jpg')
          }
          
          await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          })
        } catch (e) {
          // ignore UI error; result still shown
        }
      } else {
        setError('No matching face found in database')
      }
    } catch (e) {
      console.error('Face recognition error:', e)
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setError('Network error: Unable to connect to recognition service. Please check if the service is running.')
      } else {
        setError('Face recognition request failed: ' + e.message)
      }
    } finally {
      setIsRecognitionLoading(false)
      setShowLoadingBackdrop(false)
      setLoadingMessage('')
    }
  }

  async function captureAndRecognize() {
    try {
      if (!videoRef.current || !canvasRef.current) return
      
      setIsRecognitionLoading(true)
      setLoadingMessage('Capturing face...')
      setShowLoadingBackdrop(true)
      
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      
      if (livenessDetectionEnabled) {
        await recognizeBlob(blob, 'frame.jpg')
      } else {
        await recognizeBlobSimple(blob, 'frame.jpg')
      }
    } catch (e) {
      console.error('Capture and recognize error:', e)
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setError('Network error: Unable to connect to recognition service. Please check if the service is running.')
      } else {
        setError('Recognition request failed: ' + e.message)
      }
      setIsRecognitionLoading(false)
      setShowLoadingBackdrop(false)
      setLoadingMessage('')
    }
  }

  async function recognizeBlob(blob, filename) {
    setError('')
    const formData = new FormData()
    formData.append('image', blob, filename)
    const recognizeUrl = getRecognitionUrl('recognize')
    const config = getRecognitionConfig()
    const res = await fetch(recognizeUrl, { 
      method: 'POST', 
      body: formData,
      signal: AbortSignal.timeout(config.timeout)
    })
    const data = await res.json()
    setLastResult(data)

    // If a confident match was found, mark attendance via backend
    const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
    if (best?.staffId) {
      try {
        const token = localStorage.getItem('token')
        await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ staffId: best.staffId })
        })
      } catch (e) {
        // ignore UI error; result still shown
      }
    }
  }

  async function recognizeBlobSimple(blob, filename) {
    setError('')
    setLoadingMessage('Recognizing face...')
    setActiveStep(2) // Face Recognition step
    
    const formData = new FormData()
    formData.append('image', blob, filename)
    
    try {
      const recognizeSimpleUrl = getRecognitionUrl('recognizeSimple')
      const config = getRecognitionConfig()
      
      const res = await fetch(recognizeSimpleUrl, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout)
      })
      
      let data
      try {
        const responseText = await res.text()
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        setError('Invalid response from recognition service: ' + parseError.message)
        return
      }
      
      setLastResult(data)

      // If a confident match was found, mark attendance via backend
      const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
      if (best?.staffId) {
        setLoadingMessage('Recording attendance...')
        setActiveStep(3) // Attendance Marked step
        try {
          const token = localStorage.getItem('token')
          
          // Create FormData to send face image and data
          const formData = new FormData()
          formData.append('staffId', best.staffId)
          formData.append('confidenceScore', best.score || 0)
          
          // Add the captured frame as the face image
          formData.append('faceImage', blob, 'face_capture.jpg')
          
          await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          })
        } catch (e) {
          // ignore UI error; result still shown
        }
      } else {
        setError('No matching face found in database')
      }
    } catch (e) {
      setError('Face recognition request failed: ' + e.message)
    } finally {
      setIsRecognitionLoading(false)
      setShowLoadingBackdrop(false)
      setLoadingMessage('')
    }
  }

  async function onSelectFile(e) {
    try {
      setError('')
      const file = e.target.files?.[0]
      if (!file) return
      
      setIsUploadLoading(true)
      setLoadingMessage('Uploading and analyzing image...')
      setShowLoadingBackdrop(true)
      
      if (livenessDetectionEnabled) {
        await recognizeBlobWithFile(file, file.name)
      } else {
        await recognizeBlobSimpleWithFile(file, file.name)
      }
      
      // reset input to allow re-upload same file
      e.target.value = ''
    } catch (err) {
      setError('Upload recognize failed')
      setIsUploadLoading(false)
      setShowLoadingBackdrop(false)
      setLoadingMessage('')
    }
  }

  async function recognizeBlobWithFile(file, filename) {
    setError('')
    setLoadingMessage('Recognizing face in uploaded image...')
    
    const formData = new FormData()
    formData.append('image', file, filename)
    const recognizeUrl = getRecognitionUrl('recognize')
    const config = getRecognitionConfig()
    const res = await fetch(recognizeUrl, { 
      method: 'POST', 
      body: formData,
      signal: AbortSignal.timeout(config.timeout)
    })
    const data = await res.json()
    setLastResult(data)

    // If a confident match was found, mark attendance via backend
    const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
    if (best?.staffId) {
      setLoadingMessage('Recording attendance...')
      try {
        const token = localStorage.getItem('token')
        
        // Create FormData to send face image and data
        const attendanceFormData = new FormData()
        attendanceFormData.append('staffId', best.staffId)
        attendanceFormData.append('confidenceScore', best.score || 0)
        attendanceFormData.append('faceImage', file, filename)
        
        await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: attendanceFormData
        })
      } catch (e) {
        // ignore UI error; result still shown
      }
    } else {
      setError('No matching face found in database')
    }
    
    setIsUploadLoading(false)
    setShowLoadingBackdrop(false)
    setLoadingMessage('')
  }

  async function recognizeBlobSimpleWithFile(file, filename) {
    setError('')
    setLoadingMessage('Recognizing face in uploaded image...')
    setActiveStep(2) // Face Recognition step
    
    const formData = new FormData()
    formData.append('image', file, filename)
    
    try {
      const recognizeSimpleUrl = getRecognitionUrl('recognizeSimple')
      const config = getRecognitionConfig()
      
      const res = await fetch(recognizeSimpleUrl, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout)
      })
      
      let data
      try {
        const responseText = await res.text()
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        setError('Invalid response from recognition service: ' + parseError.message)
        setIsUploadLoading(false)
        setShowLoadingBackdrop(false)
        setLoadingMessage('')
        return
      }
      
      setLastResult(data)

      // If a confident match was found, mark attendance via backend
      const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
      if (best?.staffId) {
        setLoadingMessage('Recording attendance...')
        setActiveStep(3) // Attendance Marked step
        try {
          const token = localStorage.getItem('token')
          
          // Create FormData to send face image and data
          const attendanceFormData = new FormData()
          attendanceFormData.append('staffId', best.staffId)
          attendanceFormData.append('confidenceScore', best.score || 0)
          attendanceFormData.append('faceImage', file, filename)
          
          await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: attendanceFormData
          })
        } catch (e) {
          // ignore UI error; result still shown
        }
      } else {
        setError('No matching face found in database')
      }
    } catch (e) {
      console.error('File upload recognition error:', e)
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        setError('Network error: Unable to connect to recognition service. Please check if the service is running.')
      } else {
        setError('Face recognition request failed: ' + e.message)
      }
    } finally {
      setIsUploadLoading(false)
      setShowLoadingBackdrop(false)
      setLoadingMessage('')
    }
  }

  if (!user || user.role !== 'admin') return <Alert severity="warning">Admin only</Alert>

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Face Recognition Attendance with Liveness Detection</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        
        {/* Liveness Detection Toggle */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={livenessDetectionEnabled}
                onChange={(e) => setLivenessDetectionEnabled(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="h6">
                {livenessDetectionEnabled ? 'Liveness Detection (Blinking & Head Movement)' : 'Simple Face Recognition Only'}
              </Typography>
            }
          />
        </Box>

        {/* Progress Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {getSteps().map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Grid container spacing={3}>
          {/* Video Section */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Camera Feed</Typography>
                <video 
                  ref={videoRef} 
                  style={{ 
                    width: '100%', 
                    maxHeight: 400, 
                    background: '#000',
                    borderRadius: 8
                  }} 
                  muted 
                  playsInline 
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                <Box display="flex" gap={2} flexWrap="wrap" sx={{ mt: 2 }}>
                  {!streaming ? (
                    <Button variant="contained" onClick={startStream} size="large">
                      Start Camera
                    </Button>
                  ) : (
                    <>
                      <Button 
                        variant="contained" 
                        onClick={startLivenessDetection}
                        disabled={livenessMode || isProcessing || isRecognitionLoading}
                        size="large"
                        startIcon={isRecognitionLoading ? <CircularProgress size={20} color="inherit" /> : null}
                      >
                        {livenessDetectionEnabled ? 'Start Liveness Detection' : 'Start Face Recognition'}
                      </Button>
                      <Button 
                        variant="outlined" 
                        onClick={captureAndRecognize}
                        disabled={livenessMode || isProcessing || isRecognitionLoading}
                        startIcon={isRecognitionLoading ? <CircularProgress size={16} color="inherit" /> : null}
                      >
                        {livenessDetectionEnabled ? 'Single Capture' : 'Quick Capture'}
                      </Button>
                      <Button variant="outlined" onClick={stopStream}>
                        Stop
                      </Button>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Liveness Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {livenessDetectionEnabled ? 'Liveness Detection Status' : 'Face Recognition Status'}
                </Typography>
                
                {livenessDetectionEnabled && livenessMode && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Capturing frames for liveness detection... ({capturedFrames.length}/6)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(capturedFrames.length / 6) * 100} 
                      sx={{ mt: 1 }}
                    />
                    {capturedFrames.length < 6 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Please keep your face in the camera and blink naturally...
                      </Typography>
                    )}
                  </Box>
                )}

                {!livenessDetectionEnabled && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Simple face recognition mode - no liveness detection required
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Just position your face in the camera and capture
                    </Typography>
                  </Box>
                )}

                {livenessDetectionEnabled ? (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label="Blinking Detected" 
                        color={livenessStatus.blinking_detected ? "success" : "default"}
                        size="small"
                      />
                      <Typography variant="body2">
                        {livenessStatus.blinking_detected ? "✓" : "✗"}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label="Head Movement" 
                        color={livenessStatus.head_movement_detected ? "success" : "default"}
                        size="small"
                      />
                      <Typography variant="body2">
                        {livenessStatus.head_movement_detected ? "✓" : "✗"}
                      </Typography>
                    </Box>
                    

                    {livenessStatus.face_quality && Object.keys(livenessStatus.face_quality).length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Face Quality</Typography>
                        <Typography variant="body2">
                          Quality Score: {(livenessStatus.face_quality.quality_score * 100).toFixed(1)}%
                        </Typography>
                        <Typography variant="body2">
                          Size OK: {livenessStatus.face_quality.size_ok ? "✓" : "✗"}
                        </Typography>
                        <Typography variant="body2">
                          Symmetry: {(livenessStatus.face_quality.symmetry * 100).toFixed(1)}%
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip 
                        label="Face Detected" 
                        color={lastResult && lastResult.matches && lastResult.matches.length > 0 ? "success" : "default"}
                        size="small"
                      />
                      <Typography variant="body2">
                        {lastResult && lastResult.matches && lastResult.matches.length > 0 ? "✓" : "✗"}
                      </Typography>
                    </Box>
                    
                    {lastResult && lastResult.matches && lastResult.matches.length > 0 && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip 
                          label="Match Found" 
                          color={lastResult.matches.find(m => m.matched) ? "success" : "warning"}
                          size="small"
                        />
                        <Typography variant="body2">
                          {lastResult.matches.find(m => m.matched) ? "✓" : "✗"}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* File Upload */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Alternative: Upload Image</Typography>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={onSelectFile} 
                />
                <Button 
                  variant="outlined" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || isUploadLoading}
                  startIcon={isUploadLoading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {isUploadLoading ? 'Processing...' : 'Upload Image to Recognize'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Results */}
          <Grid item xs={12}>
            {lastResult && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Recognition Results</Typography>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    backgroundColor: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: 'rgba(0, 0, 0, 0.7)'
        }}
        open={showLoadingBackdrop}
      >
        <Fade in={showLoadingBackdrop}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 2
          }}>
            <CircularProgress 
              size={60} 
              sx={{ 
                color: 'primary.main',
                '& .MuiCircularProgress-circle': {
                  strokeLinecap: 'round',
                }
              }} 
            />
            <Typography variant="h6" sx={{ textAlign: 'center', maxWidth: 300 }}>
              {loadingMessage}
            </Typography>
            <Box sx={{ 
              width: 200, 
              height: 4, 
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              <Box sx={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                animation: 'loading-shimmer 1.5s infinite',
                '@keyframes loading-shimmer': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' }
                }
              }} />
            </Box>
          </Box>
        </Fade>
      </Backdrop>
    </Container>
  )
}



