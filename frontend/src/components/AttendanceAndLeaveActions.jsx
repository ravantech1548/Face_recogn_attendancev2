import React, { useState } from 'react'
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

export default function AttendanceAndLeaveActions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Attendance Actions State
  const [actionStaffId, setActionStaffId] = useState('')
  const [useCustomDateTime, setUseCustomDateTime] = useState(false)
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0])
  const [customTime, setCustomTime] = useState(new Date().toTimeString().slice(0, 5))
  const [allowOverwrite, setAllowOverwrite] = useState(false)
  const [manualReason, setManualReason] = useState('')
  const [manualNotes, setManualNotes] = useState('')

  // Leave Actions State
  const [leaveStaffId, setLeaveStaffId] = useState('')
  const [leaveType, setLeaveType] = useState('')
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0])
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().split('T')[0])
  const [leaveNotes, setLeaveNotes] = useState('')
  const [leaveOverwrite, setLeaveOverwrite] = useState(false)

  // Fetch staff list
  const { data: staffList } = useQuery('staff', async () => {
    const res = await axios.get(`${API_BASE_URL}/api/staff`)
    return res.data
  }, {
    onError: (error) => {
      console.error('Staff query error:', error)
      toast.error('Failed to load staff data: ' + (error.response?.data?.message || error.message))
    }
  })

  // Check-in mutation
  const checkIn = useMutation(
    async ({ staffId, customDateTime, attendanceNotes, manualReason, overwrite }) => {
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
      if (overwrite) {
        payload.overwrite = overwrite
      }
      return axios.post(`${API_BASE_URL}/api/attendance/check-in`, payload)
    },
    {
      onSuccess: (response) => {
        const message = response.data.overwritten ? 
          'Check-in time updated successfully' : 
          'Check-in recorded'
        toast.success(message)
        queryClient.invalidateQueries('attendance')
        // Clear manual reason fields after successful check-in
        setManualReason('')
        setManualNotes('')
        setAllowOverwrite(false) // Reset overwrite flag
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-in failed'),
    }
  )

  // Check-out mutation
  const checkOut = useMutation(
    async ({ staffId, customDateTime, overwrite }) => {
      const payload = { staffId }
      if (customDateTime) {
        payload.customDateTime = customDateTime
      }
      if (overwrite) {
        payload.overwrite = overwrite
      }
      return axios.post(`${API_BASE_URL}/api/attendance/check-out`, payload)
    },
    {
      onSuccess: (response) => {
        const message = response.data.overwritten ? 
          'Check-out time updated successfully' : 
          'Check-out recorded'
        toast.success(message)
        queryClient.invalidateQueries('attendance')
        setAllowOverwrite(false) // Reset overwrite flag
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Check-out failed'),
    }
  )

  // Leave entry mutation
  const recordLeave = useMutation(
    async ({ staffId, leaveType, leaveStartDate, leaveEndDate, notes, overwrite }) => {
      const payload = {
        staffId,
        leaveType,
        leaveStartDate,
        leaveEndDate,
        notes,
        overwrite
      }
      return axios.post(`${API_BASE_URL}/api/attendance/leave`, payload)
    },
    {
      onSuccess: (response) => {
        toast.success(response.data.message)
        // Clear leave form
        setLeaveStaffId('')
        setLeaveType('')
        const today = new Date().toISOString().split('T')[0]
        setLeaveStartDate(today)
        setLeaveEndDate(today)
        setLeaveNotes('')
        setLeaveOverwrite(false)
        // Refetch attendance data
        queryClient.invalidateQueries(['attendance'])
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Leave entry failed'),
    }
  )

  // Handlers
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
      manualReason,
      overwrite: allowOverwrite
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
      customDateTime,
      overwrite: allowOverwrite
    })
  }

  const handleRecordLeave = () => {
    if (!leaveStaffId) {
      toast.error('Please select a staff member')
      return
    }
    
    if (!leaveType) {
      toast.error('Please select a leave type')
      return
    }
    
    if (!leaveStartDate) {
      toast.error('Please select a leave start date')
      return
    }
    
    if (!leaveEndDate) {
      toast.error('Please select a leave end date')
      return
    }
    
    // Validate that end date is not before start date
    const startDate = new Date(leaveStartDate)
    const endDate = new Date(leaveEndDate)
    
    if (endDate < startDate) {
      toast.error('Leave end date cannot be before start date')
      return
    }
    
    recordLeave.mutate({ 
      staffId: leaveStaffId, 
      leaveType,
      leaveStartDate,
      leaveEndDate,
      notes: leaveNotes || undefined,
      overwrite: leaveOverwrite
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

  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">Access Denied</Typography>
          <Typography variant="body2" color="text.secondary">
            Only administrators can access attendance and leave actions.
          </Typography>
        </Paper>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      {/* Attendance Actions Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Attendance Actions</Typography>
        
        {/* Custom DateTime Toggle */}
        <Box sx={{ mb: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
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
          <FormControlLabel
            control={
              <Switch
                checked={allowOverwrite}
                onChange={(e) => setAllowOverwrite(e.target.checked)}
                color="warning"
              />
            }
            label={
              <Typography variant="body2">
                Allow overwrite of existing check-in/checkout times
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
        
        {allowOverwrite && (
          <Box sx={{ mt: 2, p: 1, backgroundColor: 'warning.light', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.dark">
              ⚠️ <strong>Overwrite Mode Enabled:</strong> This will update existing check-in/checkout times for the selected date. 
              Use this to correct attendance records when face recognition captured incorrect times (e.g., when check-in failed and checkout was captured as check-in).
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Leave Actions Section */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>Leave Actions</Typography>
        
        {/* Info box explaining leave actions */}
        <Box sx={{ mb: 2, p: 1, backgroundColor: 'info.light', borderRadius: 1 }}>
          <Typography variant="caption" color="info.dark">
            📝 <strong>Leave Entry:</strong> Record leave entries separately from attendance. You can specify a start date and end date to record leave for multiple days. Leave days will automatically set check-in and checkout times to 00:00:00 and will not be counted as working days.
          </Typography>
        </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Select Staff"
                value={leaveStaffId}
                onChange={(e) => setLeaveStaffId(e.target.value)}
              >
                {staffList?.map((s) => (
                  <MenuItem key={s.staff_id} value={s.staff_id}>
                    {s.full_name} ({s.staff_id})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                type="date"
                fullWidth
                label="Leave Start Date"
                value={leaveStartDate}
                onChange={(e) => {
                  setLeaveStartDate(e.target.value)
                  // If end date is before new start date, update end date
                  if (e.target.value && leaveEndDate && e.target.value > leaveEndDate) {
                    setLeaveEndDate(e.target.value)
                  }
                }}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                type="date"
                fullWidth
                label="Leave End Date"
                value={leaveEndDate}
                onChange={(e) => setLeaveEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: leaveStartDate }}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField
                select
                fullWidth
                label="Leave Type"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                required
              >
                <MenuItem value="casual_leave">Casual Leave</MenuItem>
                <MenuItem value="medical_leave">Medical Leave</MenuItem>
                <MenuItem value="unpaid_leave">Unpaid Leave</MenuItem>
                <MenuItem value="hospitalised_leave">Hospitalised Leave</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={leaveNotes}
              onChange={(e) => setLeaveNotes(e.target.value)}
              placeholder="Additional notes for leave..."
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={leaveOverwrite}
                  onChange={(e) => setLeaveOverwrite(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Typography variant="body2">
                  Allow overwrite of existing attendance/leave
                </Typography>
              }
            />
          </Grid>

          <Grid item xs={12} sm={'auto'}>
            <Button
              variant="contained"
              color="primary"
              disabled={!leaveStaffId || !leaveType || recordLeave.isLoading}
              onClick={handleRecordLeave}
            >
              {recordLeave.isLoading ? 'Recording Leave...' : 'Record Leave'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  )
}

