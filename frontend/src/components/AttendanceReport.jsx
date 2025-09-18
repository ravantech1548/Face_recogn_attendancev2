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
  const { user } = useAuth()
  const queryClient = useQueryClient()
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

  const { data: staffList } = useQuery('staff', async () => {
    const res = await axios.get(`${API_BASE_URL}/api/staff`)
    return res.data
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
    { enabled: user?.role !== 'admin' && !!user?.userId }
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

  const { data: attendance, isLoading, refetch } = useQuery(
    ['attendance', queryParams],
    async () => {
      const res = await axios.get(`${API_BASE_URL}/api/attendance`, { params: queryParams })
      return res.data
    }
  )

  const checkIn = useMutation(
    async ({ staffId, customDateTime }) => {
      const payload = { staffId }
      if (customDateTime) {
        payload.customDateTime = customDateTime
      }
      return axios.post(`${API_BASE_URL}/api/attendance/check-in`, payload)
    },
    {
      onSuccess: () => {
        toast.success('Check-in recorded')
        queryClient.invalidateQueries('attendance')
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
    
    const customDateTime = useCustomDateTime ? `${customDate}T${customTime}:00` : null
    checkIn.mutate({ staffId: actionStaffId, customDateTime })
  }

  const handleCheckOut = () => {
    if (!actionStaffId) {
      toast.error('Please select a staff member')
      return
    }
    
    const customDateTime = useCustomDateTime ? `${customDate}T${customTime}:00` : null
    checkOut.mutate({ staffId: actionStaffId, customDateTime })
  }

  const resetCustomDateTime = () => {
    setCustomDate(new Date().toISOString().split('T')[0])
    setCustomTime(new Date().toTimeString().slice(0, 5))
  }

  const handleExport = async (format = 'excel') => {
    try {
      setIsExporting(true)
      
      const exportParams = { ...queryParams, format }
      const res = await axios.get(`${API_BASE_URL}/api/attendance/export`, { 
        params: exportParams,
        responseType: 'blob'
      })
      
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
      toast.error('Failed to export data')
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

            <Grid item xs={12} sm={'auto'}>
              <Button
                variant="contained"
                disabled={!actionStaffId || checkIn.isLoading}
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

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Check In</TableCell>
                <TableCell>Check Out</TableCell>
                <TableCell>Face Captures</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>
              ) : attendance?.length ? (
                attendance.map((a) => (
                  <TableRow key={`${a.attendance_id}`}>
                    <TableCell>{new Date(a.date).toLocaleDateString()}</TableCell>
                    <TableCell>{a.full_name} ({a.staff_id})</TableCell>
                    <TableCell>{a.department}</TableCell>
                    <TableCell>{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{a.check_out_time ? new Date(a.check_out_time).toLocaleTimeString() : '-'}</TableCell>
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
                <TableRow><TableCell colSpan={7}>No records</TableCell></TableRow>
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


