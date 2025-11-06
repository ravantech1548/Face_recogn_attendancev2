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
  Fade,
  Snackbar,
  IconButton,
  Avatar
} from '@mui/material'
import { CheckCircle, Close } from '@mui/icons-material'
import { useAuth } from '../context/AuthContext'
import API_BASE_URL, { getRecognitionUrl, getRecognitionConfig } from '../config/api'
import toast from 'react-hot-toast'

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
  const [successPopup, setSuccessPopup] = useState({
    open: false,
    staffName: '',
    staffId: '',
    confidence: 0,
    attendanceType: ''
  })
  const [continuousMode, setContinuousMode] = useState(false)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [lastScanTime, setLastScanTime] = useState(null)
  const [cooldownList, setCooldownList] = useState([]) // Display list of staff in cooldown
  const continuousIntervalRef = useRef(null)
  const streamingRef = useRef(false) // Use ref to avoid closure issues
  const isRecognizingRef = useRef(false) // Use ref for isRecognizing too
  const recentAttendanceMarks = useRef(new Map()) // Track recent attendance marks: staffId -> timestamp

  // Update the cooldown display list
  const updateCooldownList = () => {
    const now = Date.now()
    const cooldownPeriod = 2 * 60 * 1000
    const list = []
    
    for (const [staffId, timestamp] of recentAttendanceMarks.current.entries()) {
      const elapsed = now - timestamp
      if (elapsed < cooldownPeriod) {
        const remainingSeconds = Math.ceil((cooldownPeriod - elapsed) / 1000)
        list.push({
          staffId,
          remainingSeconds,
          markedAt: new Date(timestamp)
        })
      }
    }
    
    setCooldownList(list)
  }

  const showSuccessPopup = (staffName, staffId, confidence, attendanceType) => {
    setSuccessPopup({
      open: true,
      staffName,
      staffId,
      confidence,
      attendanceType
    })
    
    // Show toast notification as well
    toast.success(`✅ ${attendanceType} recorded for ${staffName} (${staffId})`, {
      duration: user?.role === 'operator' ? 3000 : 4000, // Shorter for operators
      position: 'top-right',
      style: {
        background: '#4caf50',
        color: 'white',
        fontSize: '16px',
        padding: '16px',
        borderRadius: '8px'
      }
    })
    
    // Auto close popup (shorter for operators in continuous mode)
    const closeDelay = user?.role === 'operator' && continuousMode ? 2000 : 4000
    setTimeout(() => {
      setSuccessPopup(prev => ({ ...prev, open: false }))
    }, closeDelay)
  }

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

  // Auto-start camera for operators
  useEffect(() => {
    if (user?.role === 'operator') {
      console.log('[INIT] Operator detected - starting auto-mode')
      // Auto-start camera and continuous recognition for operators
      const initOperatorMode = async () => {
        console.log('[INIT] Starting camera stream...')
        await startStream()
        console.log('[INIT] Camera stream started, waiting 2 seconds before starting continuous recognition...')
        setTimeout(() => {
          console.log('[INIT] Starting continuous recognition...')
          startContinuousRecognition()
        }, 2000) // Wait 2 seconds for camera to fully initialize and streaming state to be set
      }
      initOperatorMode()
    }

    return () => {
      console.log('[CLEANUP] Cleaning up streams and intervals...')
      stopStream()
      stopContinuousRecognition()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user?.role])
  
  // Monitor streaming state changes for debugging
  useEffect(() => {
    console.log('[STATE] Streaming state changed to:', streaming)
    streamingRef.current = streaming
  }, [streaming])
  
  useEffect(() => {
    console.log('[STATE] Continuous mode changed to:', continuousMode)
  }, [continuousMode])
  
  // Sync isRecognizing state with ref
  useEffect(() => {
    console.log('[STATE] isRecognizing changed to:', isRecognizing)
    isRecognizingRef.current = isRecognizing
  }, [isRecognizing])
  
  // Update cooldown list display every second
  useEffect(() => {
    if (continuousMode) {
      const updateInterval = setInterval(() => {
        updateCooldownList()
      }, 1000) // Update every second to show countdown
      
      return () => clearInterval(updateInterval)
    }
  }, [continuousMode])

  // Start continuous face recognition
  function startContinuousRecognition() {
    if (continuousIntervalRef.current) {
      console.log('[CONTINUOUS] Already running')
      return // Already running
    }
    
    console.log('[CONTINUOUS] Starting continuous face recognition mode')
    console.log('[CONTINUOUS] Will scan for faces every 3 seconds')
    console.log('[CONTINUOUS] Current streamingRef.current:', streamingRef.current)
    setContinuousMode(true)
    
    // Check for faces every 3 seconds - use refs to avoid closure issues
    continuousIntervalRef.current = setInterval(async () => {
      const isStreamingNow = streamingRef.current
      const isRecognizingNow = isRecognizingRef.current
      console.log('[CONTINUOUS] Interval triggered - isRecognizingRef:', isRecognizingNow, 'streamingRef:', isStreamingNow)
      
      if (!isRecognizingNow && isStreamingNow) {
        console.log('[CONTINUOUS] ✅ Conditions met, triggering capture!')
        await captureAndRecognizeAuto()
      } else {
        if (isRecognizingNow) console.log('[CONTINUOUS] ⏸️ Skipping - already recognizing')
        if (!isStreamingNow) console.log('[CONTINUOUS] ⏸️ Skipping - not streaming (streamingRef.current =', streamingRef.current, ')')
      }
    }, 3000)
    
    console.log('[CONTINUOUS] Continuous mode activated successfully')
  }

  // Stop continuous recognition
  function stopContinuousRecognition() {
    setContinuousMode(false)
    if (continuousIntervalRef.current) {
      clearInterval(continuousIntervalRef.current)
      continuousIntervalRef.current = null
    }
  }

  // Auto capture and recognize (for continuous mode)
  async function captureAndRecognizeAuto() {
    if (!videoRef.current || !canvasRef.current) {
      console.log('[AUTO-CAPTURE] Video or canvas ref not available')
      return
    }
    
    setIsRecognizing(true)
    isRecognizingRef.current = true
    setScanCount(prev => prev + 1)
    setLastScanTime(new Date())
    
    const currentScan = scanCount + 1
    console.log('[AUTO-CAPTURE] ========== SCAN #' + currentScan + ' ==========')
    console.log('[AUTO-CAPTURE] Starting automatic capture at', new Date().toLocaleTimeString())
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      
      console.log('[AUTO-CAPTURE] Video ready state:', video.readyState, 'Video dimensions:', video.videoWidth, 'x', video.videoHeight)
      
      if (video.readyState !== 4 || video.videoWidth === 0) {
        console.log('[AUTO-CAPTURE] Video not ready yet, skipping this cycle')
        setIsRecognizing(false)
        isRecognizingRef.current = false
        return
      }
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      
      console.log('[AUTO-CAPTURE] Frame captured from video, creating blob...')
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      
      if (!blob) {
        console.log('[AUTO-CAPTURE] Failed to create blob')
        setIsRecognizing(false)
        isRecognizingRef.current = false
        return
      }
      
      console.log('[AUTO-CAPTURE] ✅ Blob created successfully! Size:', blob.size, 'bytes')
      console.log('[AUTO-CAPTURE] 📤 Sending to Python recognition service...')
      
      // Send for recognition
      await recognizeBlobSimple(blob, `auto-capture-${currentScan}.jpg`)
      
      console.log('[AUTO-CAPTURE] ========== END SCAN #' + currentScan + ' ==========')
      
    } catch (error) {
      console.error('[AUTO-CAPTURE] ❌ Error in scan #' + currentScan + ':', error)
    } finally {
      setIsRecognizing(false)
      isRecognizingRef.current = false
      console.log('[AUTO-CAPTURE] Recognition completed, isRecognizing set to false')
    }
  }

  async function startStream() {
    setError('')
    setActiveStep(0)
    
    // Check if browser supports camera access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('❌ Camera not supported in this browser. Please use Chrome, Firefox, or Edge.')
      return
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      
      if (videoRef.current) {
        // Stop any existing stream first
        const existingStream = videoRef.current.srcObject
        if (existingStream) {
          existingStream.getTracks().forEach(track => track.stop())
        }
        
        // Set new stream
        videoRef.current.srcObject = stream
        
        // Wait for video to be ready before playing
        videoRef.current.onloadedmetadata = async () => {
          try {
            // Small delay to ensure video is fully ready
            await new Promise(resolve => setTimeout(resolve, 100))
            
            // Now play the video
            const playPromise = videoRef.current.play()
            
            if (playPromise !== undefined) {
              await playPromise
              setStreaming(true)
              streamingRef.current = true
              setActiveStep(1)
              console.log('[STREAM] Video playing, streaming set to true')
            }
          } catch (playError) {
            console.error('Video play error:', playError)
            // If play fails, try again after a longer delay
            setTimeout(async () => {
              try {
                await videoRef.current.play()
                setStreaming(true)
                streamingRef.current = true
                setActiveStep(1)
                console.log('[STREAM] Video playing (retry), streaming set to true')
              } catch (retryError) {
                console.error('Retry play error:', retryError)
                // Still set streaming to true if we have the stream
                setStreaming(true)
                streamingRef.current = true
                setActiveStep(1)
                console.log('[STREAM] Video has stream even with play error, streaming set to true')
              }
            }, 500)
          }
        }
      }
    } catch (e) {
      console.error('Camera access error:', e)
      
      // Provide specific error messages
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('🚫 Camera access denied. Please click the camera icon in the address bar and allow camera access, then refresh the page.')
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setError('📹 No camera found. Please connect a webcam and refresh the page.')
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        setError('⚠️ Camera is being used by another application. Please close other apps using the camera and try again.')
      } else if (e.name === 'OverconstrainedError') {
        setError('⚙️ Camera does not meet requirements. Trying with default settings...')
        // Retry with simpler constraints
        try {
          const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true })
          if (videoRef.current) {
            videoRef.current.srcObject = simpleStream
            videoRef.current.onloadedmetadata = async () => {
              try {
                await videoRef.current.play()
                setStreaming(true)
                streamingRef.current = true
                setActiveStep(1)
                setError('')
                console.log('[STREAM] Video playing (simple mode), streaming set to true')
              } catch (playError) {
                setStreaming(true)
                streamingRef.current = true
                setActiveStep(1)
                setError('')
                console.log('[STREAM] Video has stream (simple mode with play error), streaming set to true')
              }
            }
          }
        } catch (retryError) {
          setError('❌ Unable to access camera. Please check camera permissions and try again.')
        }
      } else if (e.name === 'SecurityError') {
        setError('🔒 HTTPS required for camera access. Please ensure you are using HTTPS (https://) and not HTTP.')
      } else {
        // Ignore play() interruption errors - camera still works
        if (e.message && e.message.includes('play() request was interrupted')) {
          console.warn('Play interrupted but continuing anyway')
          setStreaming(true)
          streamingRef.current = true
          setActiveStep(1)
          console.log('[STREAM] Play interrupted but stream exists, streaming set to true')
        } else {
          setError(`❌ Unable to access camera: ${e.message || 'Unknown error'}. Please check permissions and try again.`)
        }
      }
    }
  }

  function stopStream() {
    console.log('[STREAM] Stopping camera stream')
    setStreaming(false)
    streamingRef.current = false
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
    console.log('[STREAM] Camera stream stopped, streaming set to false')
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
          
          const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formData
          })
          
          if (attendanceResponse.ok) {
            const attendanceData = await attendanceResponse.json()
            // Show success popup with staff details
            showSuccessPopup(
              best.fullName || best.staffId, 
              best.staffId, 
              best.score || 0, 
              attendanceData.attendanceType || 'Check-in'
            )
          }
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
    console.log('[RECOGNIZE] Starting recognition for:', filename, 'Blob size:', blob.size, 'bytes')
    
    setError('')
    setLoadingMessage('Recognizing face...')
    setActiveStep(2) // Face Recognition step
    
    const formData = new FormData()
    formData.append('image', blob, filename)
    
    try {
      const recognizeSimpleUrl = getRecognitionUrl('recognizeSimple')
      const config = getRecognitionConfig()
      
      console.log('[RECOGNIZE] Sending to Python service:', recognizeSimpleUrl)
      console.log('[RECOGNIZE] Timeout configured:', config.timeout, 'ms')
      
      const startTime = Date.now()
      const res = await fetch(recognizeSimpleUrl, { 
        method: 'POST', 
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(config.timeout)
      })
      
      const requestDuration = Date.now() - startTime
      console.log('[RECOGNIZE] Response received in', requestDuration, 'ms')
      console.log('[RECOGNIZE] Response status:', res.status, res.statusText)
      
      let data
      try {
        const responseText = await res.text()
        console.log('[RECOGNIZE] Response text length:', responseText.length)
        data = JSON.parse(responseText)
        console.log('[RECOGNIZE] Parsed response:', data)
      } catch (parseError) {
        console.error('[RECOGNIZE] JSON parse error:', parseError)
        setError('Invalid response from recognition service: ' + parseError.message)
        return
      }
      
      setLastResult(data)

      // If a confident match was found, mark attendance via backend
      const best = Array.isArray(data?.matches) ? data.matches.find(m => m.matched) : null
      console.log('[RECOGNIZE] Best match:', best)
      
      if (best?.staffId) {
        console.log('[RECOGNIZE] Match found! Staff:', best.staffId, 'Confidence:', best.score)
        
        // Check cooldown period (2 minutes) to prevent duplicate marks
        const now = Date.now()
        const lastMarkTime = recentAttendanceMarks.current.get(best.staffId)
        const cooldownPeriod = 2 * 60 * 1000 // 2 minutes in milliseconds
        
        if (lastMarkTime && (now - lastMarkTime) < cooldownPeriod) {
          const remainingSeconds = Math.ceil((cooldownPeriod - (now - lastMarkTime)) / 1000)
          const elapsedSeconds = Math.floor((now - lastMarkTime) / 1000)
          console.log(`[RECOGNIZE] ⏸️ Cooldown active for Staff ${best.staffId}. Wait ${remainingSeconds} more seconds.`)
          
          // Show info message in continuous mode (don't show as error)
          if (continuousMode) {
            console.log(`[RECOGNIZE] Skipping attendance mark for ${best.fullName || best.staffId} - marked ${elapsedSeconds}s ago`)
            // Show brief toast notification
            toast.info(`${best.fullName || best.staffId} already marked ${elapsedSeconds}s ago. Cooldown: ${remainingSeconds}s remaining.`, {
              duration: 2000,
              position: 'top-center',
              style: {
                background: '#2196f3',
                color: 'white',
                fontSize: '14px'
              }
            })
          } else {
            setError(`${best.fullName || best.staffId} was already marked ${elapsedSeconds} seconds ago. Wait ${remainingSeconds} more seconds.`)
          }
          return
        }
        
        console.log('[RECOGNIZE] ✅ Cooldown check passed, proceeding to mark attendance')
        setLoadingMessage('Recording attendance...')
        setActiveStep(3) // Attendance Marked step
        try {
          const token = localStorage.getItem('token')
          
          // Create FormData to send face image and data
          const attendanceFormData = new FormData()
          attendanceFormData.append('staffId', best.staffId)
          attendanceFormData.append('confidenceScore', best.score || 0)
          
          // Add the captured frame as the face image
          attendanceFormData.append('faceImage', blob, 'face_capture.jpg')
          
          console.log('[RECOGNIZE] Sending attendance to backend:', `${API_BASE_URL}/api/attendance/face-event`)
          
          const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: attendanceFormData
          })
          
          console.log('[RECOGNIZE] Attendance response status:', attendanceResponse.status)
          
          if (attendanceResponse.ok) {
            const attendanceData = await attendanceResponse.json()
            console.log('[RECOGNIZE] Attendance marked successfully:', attendanceData)
            
            // Record this attendance mark with timestamp
            recentAttendanceMarks.current.set(best.staffId, now)
            console.log(`[RECOGNIZE] 🕐 Cooldown started for Staff ${best.staffId} - 2 minutes`)
            
            // Update cooldown display list
            updateCooldownList()
            
            // Clean up old entries (older than 3 minutes)
            const threeMinutesAgo = now - (3 * 60 * 1000)
            for (const [staffId, timestamp] of recentAttendanceMarks.current.entries()) {
              if (timestamp < threeMinutesAgo) {
                recentAttendanceMarks.current.delete(staffId)
                console.log(`[RECOGNIZE] 🧹 Cleaned up old cooldown for Staff ${staffId}`)
              }
            }
            
            // Update display after cleanup
            updateCooldownList()
            
            // Show success popup with staff details
            showSuccessPopup(
              best.fullName || best.staffId, 
              best.staffId, 
              best.score || 0, 
              attendanceData.action || attendanceData.attendanceType || 'Check-in'
            )
          } else {
            const errorText = await attendanceResponse.text()
            console.error('[RECOGNIZE] Attendance marking failed:', errorText)
          }
        } catch (e) {
          console.error('[RECOGNIZE] Attendance error:', e)
          // ignore UI error; result still shown
        }
      } else {
        console.log('[RECOGNIZE] No matching face found')
        if (!continuousMode) {
          setError('No matching face found in database')
        }
      }
    } catch (e) {
      console.error('[RECOGNIZE] Recognition error:', e)
      if (!continuousMode) {
        setError('Face recognition request failed: ' + e.message)
      }
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
          
          const attendanceResponse = await fetch(`${API_BASE_URL}/api/attendance/face-event`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: attendanceFormData
          })
          
          if (attendanceResponse.ok) {
            const attendanceData = await attendanceResponse.json()
            // Show success popup with staff details
            showSuccessPopup(
              best.fullName || best.staffId, 
              best.staffId, 
              best.score || 0, 
              attendanceData.attendanceType || 'Check-in'
            )
          }
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

  // Allow both admin and operator roles to access face attendance
  if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
    return <Alert severity="warning">Access denied. Admin or Operator role required.</Alert>
  }

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 1, sm: 3 }, px: { xs: 1, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
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
        <Box sx={{ mb: 3 }}>
          {/* Desktop Stepper */}
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Stepper activeStep={activeStep}>
              {getSteps().map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
          
          {/* Mobile Stepper - 2 Rows */}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {getSteps().map((label, index) => (
                <Box
                  key={label}
                  sx={{
                    flex: '0 0 calc(50% - 4px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 2,
                    backgroundColor: index <= activeStep ? 'primary.main' : 'grey.200',
                    color: index <= activeStep ? 'white' : 'text.secondary',
                    transition: 'all 0.3s ease',
                    minHeight: 48,
                    justifyContent: 'center',
                    textAlign: 'center'
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: index <= activeStep ? 'white' : 'grey.400',
                      color: index <= activeStep ? 'primary.main' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: index <= activeStep ? 'bold' : 'normal',
                      lineHeight: 1.2,
                      textAlign: 'center'
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          {/* Video Section */}
          <Grid item xs={12} sm={10} md={8} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Camera Feed</Typography>
                <Box sx={{ position: 'relative', width: '100%' }}>
                  <video 
                    ref={videoRef} 
                    style={{ 
                      width: '100%', 
                      maxHeight: '50vh', 
                      background: '#000',
                      borderRadius: 8,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      display: 'block'
                    }} 
                    autoPlay
                    muted 
                    playsInline 
                  />
                  
                  {/* Scanning overlay for continuous mode */}
                  {continuousMode && isRecognizing && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        backgroundColor: 'rgba(76, 175, 80, 0.95)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        fontSize: '15px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}
                    >
                      <CircularProgress size={18} color="inherit" thickness={5} />
                      Scanning for faces...
                    </Box>
                  )}
                  
                  {/* Ready indicator when not scanning */}
                  {continuousMode && !isRecognizing && streaming && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        backgroundColor: 'rgba(33, 150, 243, 0.95)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '24px',
                        fontSize: '15px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 10
                      }}
                    >
                      ✓ Ready
                    </Box>
                  )}
                </Box>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {/* Continuous mode indicator for operators */}
                {user?.role === 'operator' && streaming && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: continuousMode ? 'success.light' : 'info.light', borderRadius: 1 }}>
                    <Typography variant="body2" color={continuousMode ? 'success.dark' : 'info.dark'} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {continuousMode ? (
                        <>
                          <CircularProgress size={16} color="inherit" />
                          <strong>Continuous Recognition Active</strong> - System is automatically scanning for faces...
                        </>
                      ) : (
                        <strong>⚠️ Continuous mode not started</strong>
                      )}
                    </Typography>
                    <Typography variant="caption" color={continuousMode ? 'success.dark' : 'info.dark'} sx={{ display: 'block' }}>
                      Total scans: {scanCount} | Last scan: {lastScanTime ? lastScanTime.toLocaleTimeString() : 'N/A'} | Streaming: {streaming ? 'Yes' : 'No'} | Recognizing: {isRecognizing ? 'Yes' : 'No'}
                    </Typography>
                    
                    {/* Manual trigger button - only if continuous mode didn't auto-start */}
                    {!continuousMode && (
                      <Box sx={{ mt: 1 }}>
                        <Button 
                          variant="contained" 
                          size="small" 
                          onClick={startContinuousRecognition}
                          color="success"
                        >
                          Start Continuous Scanning
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}
                
                {/* Cooldown Period Display */}
                {user?.role === 'operator' && continuousMode && cooldownList.length > 0 && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1 }}>
                    <Typography variant="body2" color="warning.dark" sx={{ fontWeight: 'bold', mb: 1 }}>
                      ⏱️ Recently Marked (2-min cooldown):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {cooldownList.map(item => (
                        <Chip
                          key={item.staffId}
                          label={`${item.staffId} (${item.remainingSeconds}s)`}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      ))}
                    </Box>
                    <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mt: 1 }}>
                      These staff members won't be marked again until cooldown expires
                    </Typography>
                  </Box>
                )}

                {/* Control buttons - hidden for operators in continuous mode */}
                {!(user?.role === 'operator' && continuousMode) && (
                  <Box display="flex" gap={2} flexWrap="wrap" sx={{ mt: 2, justifyContent: 'center' }}>
                    {!streaming ? (
                      <Button variant="contained" onClick={startStream} size="large">
                        Start Camera
                      </Button>
                    ) : (
                      <>
                        {user?.role === 'admin' && (
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
                          </>
                        )}
                        <Button variant="outlined" onClick={stopStream}>
                          Stop Camera
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Liveness Status */}
          <Grid item xs={12} sm={10} md={8} lg={6}>
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

      {/* Success Popup */}
      <Snackbar
        open={successPopup.open}
        autoHideDuration={4000}
        onClose={() => setSuccessPopup(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Fade in={successPopup.open}>
          <Paper
            elevation={8}
            sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: 'success.main',
              color: 'white',
              minWidth: 400,
              maxWidth: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              position: 'relative',
              animation: 'successPulse 2s ease-in-out infinite',
              '@keyframes successPulse': {
                '0%': { 
                  transform: 'scale(1)',
                  boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)'
                },
                '50%': { 
                  transform: 'scale(1.02)',
                  boxShadow: '0 12px 40px rgba(76, 175, 80, 0.5)'
                },
                '100%': { 
                  transform: 'scale(1)',
                  boxShadow: '0 8px 32px rgba(76, 175, 80, 0.3)'
                }
              },
              '@keyframes iconBounce': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-4px)' }
              },
              '@keyframes iconPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.8 }
              }
            }}
          >
            <Avatar
              sx={{
                backgroundColor: 'success.dark',
                width: 56,
                height: 56,
                animation: 'iconBounce 1s ease-in-out infinite'
              }}
            >
              <CheckCircle 
                sx={{ 
                  fontSize: 32,
                  animation: 'iconPulse 1.5s ease-in-out infinite'
                }} 
              />
            </Avatar>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                ✅ Attendance Marked Successfully!
              </Typography>
              <Typography variant="body1" sx={{ mb: 0.5 }}>
                <strong>Name:</strong> {successPopup.staffName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Staff ID:</strong> {successPopup.staffId}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Confidence:</strong> {(successPopup.confidence * 100).toFixed(1)}%
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {successPopup.attendanceType}
              </Typography>
            </Box>
            
            <IconButton
              size="small"
              onClick={() => setSuccessPopup(prev => ({ ...prev, open: false }))}
              sx={{ 
                color: 'white',
                position: 'absolute',
                top: 8,
                right: 8
              }}
            >
              <Close />
            </IconButton>
          </Paper>
        </Fade>
      </Snackbar>
    </Container>
  )
}



