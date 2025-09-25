import React, { useMemo, useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  MenuItem,
  Divider,
  Avatar,
  Chip,
  Tooltip,
  Modal,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel,
  IconButton,
} from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

export default function AttendanceReport() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  
  
  // Show loading while authentication is being checked
  if (authLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">Loading...</Typography>
          <Typography variant="body2" color="text.secondary">
            Checking authentication status...
          </Typography>
        </Paper>
      </Container>
    )
  }
  
  // Show error if no user
  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">Authentication Required</Typography>
          <Typography variant="body2" color="text.secondary">
            Please log in to access the attendance report.
          </Typography>
        </Paper>
      </Container>
    )
  }
  
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [staffIdFilter, setStaffIdFilter] = useState('')
  const [actionStaffId, setActionStaffId] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [useCustomDateTime, setUseCustomDateTime] = useState(false)
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0])
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5))
  const [dateFilter, setDateFilter] = useState('current_month') // 'current_month', 'last_month', 'all'
  const [isExporting, setIsExporting] = useState(false)
  
  // Manual attendance reason fields
  const [manualReason, setManualReason] = useState('')
  const [manualNotes, setManualNotes] = useState('')

  const { data: staffList } = useQuery('staff', async () => {
    const res = await axios.get(`${API_BASE_URL}/api/staff`)
    return res.data
  }, {
    onError: (error) => {
      console.error('Staff query error:', error)
      toast.error('Failed to load staff data: ' + (error.response?.data?.message || error.message))
    }
  })

  // Get user's staff_id for normal users
  const { data: userStaffId } = useQuery(
    ['userStaffId', user?.userId],
    async () => {
      if (user?.role === 'admin') return null
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data.staff_id
    },
    { 
      enabled: user?.role !== 'admin' && !!user?.userId,
      onError: (error) => {
        console.error('User staff ID query error:', error)
        toast.error('Failed to load user data: ' + (error.response?.data?.message || error.message))
      }
    }
  )

  // Auto-set staff filter for normal users
  useEffect(() => {
    if (user?.role !== 'admin' && userStaffId) {
      setStaffIdFilter(userStaffId)
    }
  }, [user?.role, userStaffId])

  const queryParams = useMemo(() => {
    const params = {}
    
    // Apply date filter based on radio button selection
    if (dateFilter === 'current_month') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      params.startDate = firstDay.toISOString().split('T')[0]
      params.endDate = lastDay.toISOString().split('T')[0]
    } else if (dateFilter === 'last_month') {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
      params.startDate = firstDay.toISOString().split('T')[0]
      params.endDate = lastDay.toISOString().split('T')[0]
    } else if (dateFilter === 'all') {
      // No date filters applied - show all records
    }
    
    // Override with manual date selection if provided
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (staffIdFilter) params.staffId = staffIdFilter
    if (dateFilter) params.dateFilter = dateFilter
    
    return params
  }, [startDate, endDate, staffIdFilter, dateFilter])

  const { data: attendance, isLoading, refetch, error } = useQuery(
    ['attendance', queryParams],
    async () => {
      const res = await axios.get(`${API_BASE_URL}/api/attendance`, { params: queryParams })
      return res.data
    },
    {
      onError: (error) => {
        console.error('Attendance query error:', error)
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          config: error.config
        })
        toast.error('Failed to load attendance data: ' + (error.response?.data?.message || error.message))
      },
    }
  )

  const checkIn = useMutation(
    async ({ staffId, customDateTime, attendanceNotes, manualReason }) => {
      const payload = { staffId }
      if (customDateTime) {
        payload.customDateTime = customDateTime
      }
      if (attendanceNotes) {
        payload.attendanceNotes = attendanceNotes
      }
      if (manualReason) {
        payload.manualReason = manualReason
      }
      return axios.post(`${API_BASE_URL}/api/attendance/check-in`, payload)
    },
    {
      onSuccess: () => {
        toast.success('Check-in recorded')
        queryClient.invalidateQueries('attendance')
        // Clear manual reason fields after successful check-in
        setManualReason('')
        setManualNotes('')
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
    }
  )

  const checkOut = useMutation(
    async ({ staffId, customDateTime }) => {
      const payload = { staffId }
      if (customDateTime) {
        payload.customDateTime = customDateTime
      }
      return axios.post(`${API_BASE_URL}/api/attendance/check-out`, payload)
    },
    {
      onSuccess: () => {
        toast.success('Check-out recorded')
        queryClient.invalidateQueries('attendance')
        // Don't clear manual reason fields for check-out
        // They should remain for the same day's attendance
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-out failed'),
    }
  )

  const handleImageClick = (imagePath, confidenceScore) => {
    if (imagePath) {
      setSelectedImage({
        path: `${API_BASE_URL}/${imagePath}`,
        confidence: confidenceScore
      })
      setImageModalOpen(true)
    }
  }

  const closeImageModal = () => {
    setImageModalOpen(false)
    setSelectedImage(null)
  }

  const handleCheckIn = () => {
    if (!actionStaffId) {
      toast.error('Please select a staff member')
      return
    }
    
    if (!manualReason) {
      toast.error('Please select a reason for manual entry')
      return
    }
    
    if (manualReason === 'others' && !manualNotes.trim()) {
      toast.error('Please provide details for "Others" reason')
      return
    }
    
    const customDateTime = useCustomDateTime ? `${customDate}T${customTime}:00` : null
    const attendanceNotes = manualReason === 'others' ? manualNotes : `${manualReason.replace('_', ' ').toUpperCase()}`
    
    checkIn.mutate({ 
      staffId: actionStaffId, 
      customDateTime,
      attendanceNotes,
      manualReason
    })
  }

  const handleCheckOut = () => {
    if (!actionStaffId) {
      toast.error('Please select a staff member')
      return
    }
    
    const customDateTime = useCustomDateTime ? `${customDate}T${customTime}:00` : null
    
    checkOut.mutate({ 
      staffId: actionStaffId, 
      customDateTime
      // No manualReason or attendanceNotes needed for check-out
      // The check-out will use the existing reason from check-in
    })
  }

  const resetCustomDateTime = () => {
    setCustomDate(new Date().toISOString().split('T')[0])
    setCustomTime(new Date().toTimeString().slice(0, 5))
  }

  // Get available manual attendance reasons based on selected staff
  const getAvailableReasons = () => {
    const baseReasons = [
      { value: 'face_detection_failure', label: 'Face Detection Failure' },
      { value: 'others', label: 'Others' }
    ]

    // Add conditional options based on staff settings
    if (actionStaffId && staffList) {
      const selectedStaff = staffList.find(s => s.staff_id === actionStaffId)
      
      // Add Work From Home option only if selected staff has WFH enabled
      if (selectedStaff?.work_from_home_enabled) {
        baseReasons.unshift({ value: 'work_from_home', label: 'Work From Home' })
      }
      
      // Add On Duty option only if selected staff has ON DUTY enabled
      if (selectedStaff?.on_duty_enabled !== false) { // Default to true if not set
        baseReasons.unshift({ value: 'on_duty', label: 'On Duty' })
      }
    }

    return baseReasons
  }

  // Helper function to convert hh:mm format to decimal hours
  const hhmmToDecimal = (hhmm) => {
    if (!hhmm || hhmm === '00:00') return 0
    const [hours, minutes] = hhmm.split(':').map(Number)
    return hours + (minutes / 60)
  }

  // Helper function to convert decimal hours to hh:mm format
  const decimalToHHMM = (decimalHours) => {
    if (!decimalHours || decimalHours === 0) return '00:00'
    const hours = Math.floor(decimalHours)
    const minutes = Math.round((decimalHours - hours) * 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const handleExport = async (format = 'excel') => {
    try {
      setIsExporting(true)
      
      const exportParams = { ...queryParams, format }
      console.log('Exporting with params:', exportParams)
      
      const res = await axios.get(`${API_BASE_URL}/api/attendance/export`, { 
        params: exportParams,
        responseType: 'blob',
        timeout: 30000 // 30 second timeout
      })
      
      // Check if response is actually a blob
      if (!(res.data instanceof Blob)) {
        throw new Error('Invalid response format received from server')
      }
      
      // Check if blob has content
      if (res.data.size === 0) {
        throw new Error('Empty file received from server')
      }
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      
      // Generate filename based on current filter
      const now = new Date()
      let filename = 'attendance_report'
      
      if (dateFilter === 'current_month') {
        filename += `_current_month_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`
      } else if (dateFilter === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1)
        filename += `_last_month_${lastMonth.getFullYear()}_${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
      } else if (dateFilter === 'all') {
        filename += '_all_records'
      }
      
      if (staffIdFilter) {
        filename += `_staff_${staffIdFilter}`
      }
      
      filename += format === 'excel' ? '.xlsx' : '.csv'
      
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      toast.success(`${format.toUpperCase()} file downloaded successfully`)
    } catch (error) {
      console.error('Export error:', error)
      
      let errorMessage = 'Failed to export data'
      
      if (error.response) {
        // Server responded with error status
        if (error.response.status === 500) {
          errorMessage = 'Server error during export. Please try again.'
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.'
        } else if (error.response.status === 403) {
          errorMessage = 'Permission denied. Contact administrator.'
        } else {
          errorMessage = `Export failed: ${error.response.data?.message || 'Unknown server error'}`
        }
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (error.message) {
        // Other error
        errorMessage = `Export failed: ${error.message}`
      }
      
      toast.error(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      
      {user?.role === 'admin' && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>Attendance Actions</Typography>
          
          {/* Custom DateTime Toggle */}
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCustomDateTime}
                  onChange={(e) => {
                    setUseCustomDateTime(e.target.checked)
                    if (e.target.checked) {
                      resetCustomDateTime()
                    }
                  }}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  Use custom date/time for backdating attendance
                </Typography>
              }
            />
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Select Staff"
                value={actionStaffId}
                onChange={(e) => setActionStaffId(e.target.value)}
              >
                {staffList?.map((s) => (
                  <MenuItem key={s.staff_id} value={s.staff_id}>
                    {s.full_name} ({s.staff_id})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {useCustomDateTime && (
              <>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField
                    type="date"
                    fullWidth
                    label="Date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <TextField
                    type="time"
                    fullWidth
                    label="Time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 300 }} // 5 minute intervals
                  />
                </Grid>
              </>
            )}

            {/* Manual Attendance Reason Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Manual Entry Reason (Check-in Only)
                </Typography>
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                select
                fullWidth
                label="Reason for Manual Entry"
                value={manualReason}
                onChange={(e) => {
                  setManualReason(e.target.value)
                  if (e.target.value !== 'others') {
                    setManualNotes('')
                  }
                }}
                required
              >
                {getAvailableReasons().map((reason) => (
                  <MenuItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            {manualReason === 'others' && (
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  fullWidth
                  label="Please specify reason"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Enter details for manual entry..."
                  multiline
                  rows={2}
                  required
                />
              </Grid>
            )}

            {/* Info box explaining the behavior */}
            <Grid item xs={12}>
              <Box sx={{ mt: 1, p: 1, backgroundColor: 'info.light', borderRadius: 1 }}>
                <Typography variant="caption" color="info.dark">
                  💡 <strong>Note:</strong> Manual entry reason is only required for check-in. Check-out will use the same reason from the check-in for the same day.
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={'auto'}>
              <Button
                variant="contained"
                disabled={!actionStaffId || !manualReason || checkIn.isLoading}
                onClick={handleCheckIn}
              >
                {checkIn.isLoading ? 'Checking in...' : 'Check In'}
              </Button>
            </Grid>
            <Grid item xs={12} sm={'auto'}>
              <Button
                variant="outlined"
                disabled={!actionStaffId || checkOut.isLoading}
                onClick={handleCheckOut}
              >
                {checkOut.isLoading ? 'Checking out...' : 'Check Out'}
              </Button>
            </Grid>
          </Grid>

          {useCustomDateTime && (
            <Box sx={{ mt: 2, p: 1, backgroundColor: 'info.light', borderRadius: 1 }}>
              <Typography variant="caption" color="info.dark">
                💡 <strong>Backdating Mode:</strong> Attendance will be recorded for {customDate} at {customTime}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Attendance Report</Typography>
          <Box display="flex" gap={2} alignItems="center">
            <Button 
              variant="contained" 
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('excel')}
              disabled={isExporting}
            >
              Excel
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('csv')}
              disabled={isExporting}
            >
              CSV
            </Button>
          </Box>
        </Box>

        {/* Date Filter Radio Buttons */}
        <Box sx={{ mb: 2 }}>
          <FormControl component="fieldset">
            <FormLabel component="legend">Date Filter</FormLabel>
            <RadioGroup
              row
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <FormControlLabel 
                value="current_month" 
                control={<Radio />} 
                label="Current Month" 
              />
              <FormControlLabel 
                value="last_month" 
                control={<Radio />} 
                label="Last Month" 
              />
              <FormControlLabel 
                value="all" 
                control={<Radio />} 
                label="All Records" 
              />
            </RadioGroup>
          </FormControl>
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="body2" color="text.secondary">
            {dateFilter === 'current_month' && 'Showing current month records'}
            {dateFilter === 'last_month' && 'Showing last month records'}
            {dateFilter === 'all' && 'Showing all records'}
          </Typography>
          <Box display="flex" gap={2}>
            <TextField 
              type="date" 
              label="Custom Start Date" 
              InputLabelProps={{ shrink: true }} 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              size="small"
            />
            <TextField 
              type="date" 
              label="Custom End Date" 
              InputLabelProps={{ shrink: true }} 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
            />
            {user?.role === 'admin' && (
              <TextField 
                select 
                label="Staff Filter" 
                value={staffIdFilter} 
                onChange={(e) => setStaffIdFilter(e.target.value)} 
                sx={{ minWidth: 200 }}
                size="small"
              >
                <MenuItem value="">All staff</MenuItem>
                {staffList?.map((s) => (
                  <MenuItem key={s.staff_id} value={s.staff_id}>{s.full_name} ({s.staff_id})</MenuItem>
                ))}
              </TextField>
            )}
            <Button 
              variant="outlined" 
              onClick={() => { 
                setStartDate(''); 
                setEndDate(''); 
                setStaffIdFilter(''); 
                setDateFilter('current_month');
                refetch() 
              }}
              size="small"
            >
              Reset
            </Button>
          </Box>
        </Box>
        <Divider sx={{ mb: 2 }} />

        {/* Error Display */}
        {error && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: 'error.light', borderRadius: 2 }}>
            <Typography variant="h6" color="error.dark" gutterBottom>
              Error Loading Data
            </Typography>
            <Typography variant="body2" color="error.dark">
              {error.response?.data?.message || error.message || 'An unknown error occurred'}
            </Typography>
            <Button 
              variant="contained" 
              color="error" 
              onClick={() => refetch()}
              sx={{ mt: 1 }}
            >
              Retry
            </Button>
          </Box>
        )}

        {/* Summary Statistics */}
        {attendance && attendance.length > 0 && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>Summary Statistics</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="primary">
                    {attendance.filter(a => a.total_hours).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Days Worked
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="success.main">
                    {decimalToHHMM(attendance.reduce((sum, a) => sum + hhmmToDecimal(a.total_hours), 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Hours
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="success.main">
                    {decimalToHHMM(attendance.reduce((sum, a) => sum + hhmmToDecimal(a.day_hours), 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Regular Hours
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="warning.main">
                    {decimalToHHMM(attendance.reduce((sum, a) => sum + hhmmToDecimal(a.overtime_hours), 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Overtime Hours
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="error.main">
                    {attendance.reduce((sum, a) => sum + (parseInt(a.late_arrival_minutes) || 0), 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Late Minutes
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ textAlign: 'center', p: 1 }}>
                  <Typography variant="h4" color="info.main">
                    {attendance.filter(a => a.work_from_home).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    WFH Days
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Work Status</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Project Code</TableCell>
                <TableCell>Check In</TableCell>
                <TableCell>Check Out</TableCell>
                <TableCell>Total Hours</TableCell>
                <TableCell>Day Hours</TableCell>
                <TableCell>Overtime</TableCell>
                <TableCell>Late Arrival</TableCell>
                <TableCell>Early Departure</TableCell>
                <TableCell>Break Time</TableCell>
                <TableCell>WFH</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Face Captures</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={17}>Loading...</TableCell></TableRow>
              ) : attendance?.length ? (
                attendance.map((a) => (
                  <TableRow key={`${a.attendance_id}`}>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{a.full_name} ({a.staff_id})</TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>
                      <Chip 
                        label={a.work_status || 'Full-time'} 
                        size="small" 
                        color={a.work_status === 'Full-time' ? 'success' : a.work_status === 'Part-time' ? 'warning' : 'info'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{a.manager_name || '-'}</TableCell>
                    <TableCell>{a.project_code || '-'}</TableCell>
                    <TableCell>{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>
                      {a.total_hours ? (
                        <Chip 
                          label={`${a.total_hours}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {a.day_hours ? (
                        <Chip 
                          label={`${a.day_hours}`} 
                          size="small" 
                          color="success" 
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {a.overtime_hours && a.overtime_hours !== '00:00' ? (
                        <Chip 
                          label={`${a.overtime_hours}`} 
                          size="small" 
                          color="warning" 
                          variant="filled"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {parseInt(a.late_arrival_minutes) > 0 ? (
                        <Chip 
                          label={`${a.late_arrival_minutes} min`} 
                          size="small" 
                          color="error" 
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {parseInt(a.early_departure_minutes) > 0 ? (
                        <Chip 
                          label={`${a.early_departure_minutes} min`} 
                          size="small" 
                          color="error" 
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {a.break_time_minutes ? (
                        <Chip 
                          label={`${a.break_time_minutes} min`} 
                          size="small" 
                          color="info" 
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={a.work_from_home ? 'Yes' : 'No'} 
                        size="small" 
                        color={a.work_from_home ? 'success' : 'default'}
                        variant={a.work_from_home ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      {a.attendance_notes ? (
                        <Tooltip title={a.attendance_notes}>
                          <Typography variant="caption" sx={{ 
                            maxWidth: 100, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer'
                          }}>
                            {a.attendance_notes}
                          </Typography>
                        </Tooltip>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1} alignItems="center">
                        {a.check_in_face_image_path && (
                          <Tooltip title={`Check-in face (Confidence: ${(a.check_in_confidence_score * 100).toFixed(1)}%)`}>
                            <Avatar
                              src={`${API_BASE_URL}/${a.check_in_face_image_path}`}
                              sx={{ width: 32, height: 32, cursor: 'pointer' }}
                              onClick={() => handleImageClick(a.check_in_face_image_path, a.check_in_confidence_score)}
                            />
                          </Tooltip>
                        )}
                        {a.check_out_face_image_path && (
                          <Tooltip title={`Check-out face (Confidence: ${(a.check_out_confidence_score * 100).toFixed(1)}%)`}>
                            <Avatar
                              src={`${API_BASE_URL}/${a.check_out_face_image_path}`}
                              sx={{ width: 32, height: 32, cursor: 'pointer' }}
                              onClick={() => handleImageClick(a.check_out_face_image_path, a.check_out_confidence_score)}
                            />
                          </Tooltip>
                        )}
                        {!a.check_in_face_image_path && !a.check_out_face_image_path && (
                          <Typography variant="caption" color="text.secondary">No captures</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{a.status}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={17}>No records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Face Image Modal */}
      <Modal
        open={imageModalOpen}
        onClose={closeImageModal}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 2,
            borderRadius: 2,
            maxWidth: '90vw',
            maxHeight: '90vh',
            outline: 'none',
          }}
        >
          {selectedImage && (
            <>
              <Typography variant="h6" gutterBottom>
                Face Capture Audit
              </Typography>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <img
                  src={selectedImage.path}
                  alt="Face capture"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '60vh',
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                  label={`Confidence: ${(selectedImage.confidence * 100).toFixed(1)}%`}
                  color={selectedImage.confidence > 0.8 ? 'success' : selectedImage.confidence > 0.6 ? 'warning' : 'error'}
                  size="small"
                />
                <Button variant="outlined" onClick={closeImageModal}>
                  Close
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Modal>
    </Container>
  )
}


