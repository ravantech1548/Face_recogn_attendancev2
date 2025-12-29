import React, { useState, useMemo } from 'react'
import {
  Container,
  Paper,
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import { Download, ChevronLeft, ChevronRight, Close, Description } from '@mui/icons-material'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

const statusColor = {
  present: '#e6ffed',      // Light Green
  absent: '#ffe6e6',       // Light Red
  leave: '#fff7e6',        // Light Orange
  holiday: '#f0f0f0',      // Light Grey
  weekend: '#fafafa',       // Very Light Grey
  default: '#ffffff'       // White
}

export default function CalendarAttendanceDashboard() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingDetailed, setIsExportingDetailed] = useState(false)
  
  // Get current date for default month/year
  // Default to current month, or if current month has no data, show a message
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [staffIdFilter, setStaffIdFilter] = useState('')

  // Fetch staff list for filter
  const { data: staffList = [] } = useQuery(
    'staff',
    async () => {
      const res = await axios.get(`${API_BASE_URL}/api/staff`)
      return res.data
    },
    {
      enabled: user?.role === 'admin',
      onError: (error) => {
        console.error('Staff query error:', error)
      }
    }
  )

  // Fetch calendar view data
  const { data: calendarData, isLoading, error, refetch } = useQuery(
    ['calendar-view', selectedYear, selectedMonth, staffIdFilter],
    async () => {
      const params = { year: selectedYear, month: selectedMonth }
      if (staffIdFilter) params.staffId = staffIdFilter
      
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar-view`, {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      
      // Debug logging
      console.log('Calendar Data Received:', {
        summaryCount: res.data.summary?.length,
        sampleDays: res.data.summary?.slice(0, 5).map(d => ({
          date: d.date,
          present: d.total_present,
          leave: d.total_leave,
          absent: d.total_absent
        })),
        dateFormats: res.data.summary?.slice(0, 3).map(d => ({
          date: d.date,
          dateType: typeof d.date
        }))
      })
      
      return res.data
    },
    {
      enabled: !!selectedYear && !!selectedMonth,
      onSuccess: (data) => {
        console.log('Calendar query success:', {
          totalDays: data.summary?.length,
          daysWithData: data.debug?.daysWithData,
          sampleData: data.summary?.filter(d => 
            parseInt(d.total_present) > 0 || 
            parseInt(d.total_leave) > 0
          ).slice(0, 3)
        })
      },
      onError: (error) => {
        console.error('Calendar view error:', error)
        const errorMessage = error.response?.data?.message || error.message
        if (error.response?.status === 404 && errorMessage.includes('Calendar table not found')) {
          toast.error('Calendar table not found. Please run database migrations.', {
            duration: 6000
          })
        } else if (error.response?.status !== 404) {
          toast.error('Failed to load calendar data: ' + errorMessage)
        }
      }
    }
  )

  // Fetch detailed data for selected date
  const { data: dateDetails, isLoading: dateDetailsLoading } = useQuery(
    ['calendar-view-date', selectedDate],
    async () => {
      const params = {}
      if (staffIdFilter) params.staffId = staffIdFilter
      
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar-view/${selectedDate}`, {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    {
      enabled: !!selectedDate && detailDialogOpen,
      onError: (error) => {
        console.error('Date details error:', error)
        toast.error('Failed to load date details: ' + (error.response?.data?.message || error.message))
      }
    }
  )

  // Generate calendar grid
  const calendarGrid = useMemo(() => {
    if (!calendarData?.summary) return []

    const firstDay = new Date(selectedYear, selectedMonth - 1, 1)
    const lastDay = new Date(selectedYear, selectedMonth, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay() // 0 = Sunday, 1 = Monday, etc.

    const grid = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push(null)
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      // Find matching day data - handle both string and Date object formats
      const dayData = calendarData.summary.find(d => {
        if (!d.date) return false
        // Handle string format (YYYY-MM-DD)
        if (typeof d.date === 'string') {
          return d.date === dateStr || d.date.startsWith(dateStr)
        }
        // Handle Date object format
        if (d.date instanceof Date) {
          const dStr = d.date.toISOString().split('T')[0]
          return dStr === dateStr
        }
        return false
      })
      grid.push({
        day,
        date: dateStr,
        ...(dayData || {})
      })
    }

    return grid
  }, [calendarData, selectedYear, selectedMonth])

  const handleDateClick = (date) => {
    if (!date) return
    setSelectedDate(date)
    setDetailDialogOpen(true)
  }

  const handleExport = async (format = 'excel') => {
    setIsExporting(true)
    try {
      const params = { year: selectedYear, month: selectedMonth, format }
      if (staffIdFilter) params.staffId = staffIdFilter
      
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar-view/export`, {
        params,
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `calendar_attendance_${selectedYear}_${selectedMonth}.${format === 'csv' ? 'csv' : 'xlsx'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success('Report downloaded successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export report: ' + (error.response?.data?.message || error.message))
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportDetailedSummary = async (format = 'excel') => {
    setIsExportingDetailed(true)
    try {
      const params = { year: selectedYear, month: selectedMonth, format }
      if (staffIdFilter) params.staffId = staffIdFilter
      
      const res = await axios.get(`${API_BASE_URL}/api/attendance/calendar-view/detailed-summary`, {
        params,
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `detailed_attendance_summary_${selectedYear}_${selectedMonth}.${format === 'csv' ? 'csv' : 'xlsx'}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      toast.success('Detailed summary report downloaded successfully')
    } catch (error) {
      console.error('Detailed summary export error:', error)
      toast.error('Failed to export detailed summary: ' + (error.response?.data?.message || error.message))
    } finally {
      setIsExportingDetailed(false)
    }
  }

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12)
      setSelectedYear(selectedYear - 1)
    } else {
      setSelectedMonth(selectedMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1)
      setSelectedYear(selectedYear + 1)
    } else {
      setSelectedMonth(selectedMonth + 1)
    }
  }

  const getDayBackgroundColor = (dayData) => {
    if (!dayData) return statusColor.default
    
    if (dayData.is_public_holiday) return statusColor.holiday
    if (dayData.is_weekend) return statusColor.weekend
    
    // Convert to numbers to handle string/null values
    const present = parseInt(dayData.total_present) || 0
    const leave = parseInt(dayData.total_leave) || 0
    const absent = parseInt(dayData.total_absent) || 0
    
    // For working days, show color based on attendance
    if (absent > 0 && present === 0 && leave === 0) {
      return statusColor.absent
    } else if (present > 0) {
      return statusColor.present
    } else if (leave > 0) {
      return statusColor.leave
    }
    
    return statusColor.default
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">Authentication Required</Typography>
        </Paper>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 3, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              Calendar Attendance Dashboard
            </Typography>
          </Box>
          
          {/* Export Buttons Section */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mr: 1, fontWeight: 'bold' }}>Export Options:</Typography>
            <Tooltip title="Export calendar view summary (day-wise totals)">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                onClick={() => handleExport('excel')}
                disabled={isExporting || isLoading}
              >
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </Button>
            </Tooltip>
            <Tooltip title="Export calendar view summary (day-wise totals)">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download />}
                onClick={() => handleExport('csv')}
                disabled={isExporting || isLoading}
              >
                Export CSV
              </Button>
            </Tooltip>
            <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 1 }} />
            <Tooltip title="Export detailed staff summary report with daily attendance status for each employee (staff-wise with days as columns)">
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Description />}
                onClick={() => handleExportDetailedSummary('excel')}
                disabled={isExportingDetailed || isLoading}
              >
                {isExportingDetailed ? 'Exporting...' : 'Export Detailed Summary'}
              </Button>
            </Tooltip>
            <Tooltip title="Export detailed staff summary report with daily attendance status for each employee (staff-wise with days as columns)">
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<Description />}
                onClick={() => handleExportDetailedSummary('csv')}
                disabled={isExportingDetailed || isLoading}
              >
                Detailed Summary (CSV)
              </Button>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <IconButton onClick={handlePreviousMonth} size="small">
              <ChevronLeft />
            </IconButton>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {monthNames.map((month, index) => (
                  <MenuItem key={index + 1} value={index + 1}>
                    {month}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="number"
              size="small"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              inputProps={{ min: 2024, max: 2030 }}
              sx={{ width: 100 }}
            />
            <IconButton onClick={handleNextMonth} size="small">
              <ChevronRight />
            </IconButton>
          </Box>
          
          {user?.role === 'admin' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Staff</InputLabel>
              <Select
                value={staffIdFilter}
                onChange={(e) => setStaffIdFilter(e.target.value)}
                label="Filter by Staff"
              >
                <MenuItem value="">All Staff</MenuItem>
                {staffList.map((staff) => (
                  <MenuItem key={staff.staff_id} value={staff.staff_id}>
                    {staff.full_name} ({staff.staff_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Legend */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip label="Present" sx={{ bgcolor: statusColor.present }} size="small" />
          <Chip label="Absent" sx={{ bgcolor: statusColor.absent }} size="small" />
          <Chip label="Leave" sx={{ bgcolor: statusColor.leave }} size="small" />
          <Chip label="Weekend" sx={{ bgcolor: statusColor.weekend }} size="small" />
          <Chip label="Holiday" sx={{ bgcolor: statusColor.holiday }} size="small" />
        </Box>

        {/* Error State */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2" component="div">
              <strong>{error.response?.data?.message || 'Failed to load calendar data'}</strong>
              {error.response?.data?.hint && (
                <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                  {error.response.data.hint}
                </Typography>
              )}
              {!error.response?.data?.hint && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Please ensure the calendar table is set up by running database migrations.
                </Typography>
              )}
            </Typography>
          </Alert>
        )}

        {/* Calendar Grid */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : calendarData?.summary && calendarData.summary.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              No calendar data available for {monthNames[selectedMonth - 1]} {selectedYear}.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Try selecting a different month that has attendance data.
            </Typography>
          </Alert>
        ) : (
          <Grid container spacing={1} sx={{ width: '100%' }}>
            {/* Day Headers */}
            {dayNames.map((day) => (
              <Grid 
                item 
                key={day} 
                sx={{ 
                  width: 'calc(100% / 7)',
                  flexBasis: 'calc(100% / 7)',
                  maxWidth: 'calc(100% / 7)',
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  py: 1 
                }}
              >
                <Typography variant="body2">{day}</Typography>
              </Grid>
            ))}

            {/* Calendar Days */}
            {calendarGrid.map((dayData, index) => {
              if (!dayData) {
                return (
                  <Grid 
                    item 
                    key={`empty-${index}`} 
                    sx={{ 
                      width: 'calc(100% / 7)',
                      flexBasis: 'calc(100% / 7)',
                      maxWidth: 'calc(100% / 7)',
                      aspectRatio: '1', 
                      minHeight: 100 
                    }} 
                  />
                )
              }

              const bgColor = getDayBackgroundColor(dayData)
              // Convert to numbers to handle string/null values from database
              const present = parseInt(dayData.total_present) || 0
              const leave = parseInt(dayData.total_leave) || 0
              const absent = parseInt(dayData.total_absent) || 0
              const otDays = parseInt(dayData.total_ot_days) || 0
              const hasOT = otDays > 0

              return (
                <Grid
                  item
                  key={dayData.date}
                  sx={{
                    width: 'calc(100% / 7)',
                    flexBasis: 'calc(100% / 7)',
                    maxWidth: 'calc(100% / 7)',
                    aspectRatio: '1',
                    minHeight: 100,
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.8 }
                  }}
                >
                  <Paper
                    elevation={1}
                    sx={{
                      p: 1,
                      height: '100%',
                      bgcolor: bgColor,
                      border: '1px solid #e0e0e0',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                    onClick={() => handleDateClick(dayData.date)}
                  >
                    <Typography variant="body2" fontWeight="bold">
                      {dayData.day}
                    </Typography>
                    
                    {dayData.is_public_holiday && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {dayData.holiday_name}
                      </Typography>
                    )}
                    
                    {!dayData.is_weekend && !dayData.is_public_holiday && (
                      <Box sx={{ mt: 'auto' }}>
                        {present > 0 && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem' }}>
                            P: {present}
                          </Typography>
                        )}
                        {absent > 0 && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: 'error.main' }}>
                            A: {absent}
                          </Typography>
                        )}
                        {leave > 0 && (
                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: 'warning.main' }}>
                            L: {leave}
                          </Typography>
                        )}
                        {hasOT && (
                          <Chip
                            label={`OT: ${otDays}`}
                            size="small"
                            color="primary"
                            sx={{ mt: 0.5, fontSize: '0.65rem', height: 18 }}
                          />
                        )}
                      </Box>
                    )}
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Paper>

      {/* Date Details Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false)
          setSelectedDate(null)
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Attendance Details - {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Typography>
            <IconButton onClick={() => {
              setDetailDialogOpen(false)
              setSelectedDate(null)
            }}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {dateDetailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : dateDetails ? (
            <Box>
              {/* Summary */}
              {dateDetails.calendarInfo && (
                <Alert severity={dateDetails.calendarInfo.is_weekend || dateDetails.calendarInfo.is_public_holiday ? 'info' : 'success'} sx={{ mb: 2 }}>
                  {dateDetails.calendarInfo.is_public_holiday && (
                    <Typography variant="body2">
                      <strong>Public Holiday:</strong> {dateDetails.calendarInfo.holiday_name}
                    </Typography>
                  )}
                  {dateDetails.calendarInfo.is_weekend && !dateDetails.calendarInfo.is_public_holiday && (
                    <Typography variant="body2">
                      <strong>Weekend Day</strong>
                    </Typography>
                  )}
                </Alert>
              )}

              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip label={`Total: ${dateDetails.summary?.total || 0}`} color="default" />
                <Chip label={`Present: ${dateDetails.summary?.present || 0}`} color="success" />
                <Chip label={`Absent: ${dateDetails.summary?.absent || 0}`} color="error" />
                <Chip label={`Leave: ${dateDetails.summary?.leave || 0}`} color="warning" />
                {dateDetails.summary?.nonWorking > 0 && (
                  <Chip label={`Non-Working: ${dateDetails.summary?.nonWorking || 0}`} />
                )}
                {dateDetails.summary?.overtime > 0 && (
                  <Chip label={`Overtime: ${dateDetails.summary?.overtime || 0}`} color="primary" />
                )}
              </Box>

              {/* Staff Table */}
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Staff ID</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell><strong>Department</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell><strong>Check In</strong></TableCell>
                      <TableCell><strong>Check Out</strong></TableCell>
                      <TableCell><strong>Total Hours</strong></TableCell>
                      <TableCell><strong>OT Hours</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dateDetails.staff?.map((staff) => (
                      <TableRow key={staff.staff_id}>
                        <TableCell>{staff.staff_id}</TableCell>
                        <TableCell>{staff.full_name}</TableCell>
                        <TableCell>{staff.department}</TableCell>
                        <TableCell>
                          {staff.status === 'non_working' ? (
                            <Chip label="Non-Working" size="small" />
                          ) : staff.attendance ? (
                            <Chip
                              label={staff.attendance.status === 'present' ? 'Present' : 
                                     ['casual_leave', 'medical_leave', 'unpaid_leave', 'hospitalised_leave'].includes(staff.attendance.status) ? 'Leave' : 
                                     staff.attendance.status}
                              size="small"
                              color={staff.attendance.status === 'present' ? 'success' : 'warning'}
                            />
                          ) : (
                            <Chip label="Absent" size="small" color="error" />
                          )}
                        </TableCell>
                        <TableCell>
                          {staff.attendance?.check_in_time
                            ? new Date(staff.attendance.check_in_time).toLocaleTimeString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {staff.attendance?.check_out_time
                            ? new Date(staff.attendance.check_out_time).toLocaleTimeString()
                            : '-'}
                        </TableCell>
                        <TableCell>{staff.attendance?.total_hours || '-'}</TableCell>
                        <TableCell>
                          {staff.attendance?.overtime_hours && staff.attendance.overtime_hours !== '00:00' ? (
                            <Chip label={staff.attendance.overtime_hours} size="small" color="primary" />
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Typography>No data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDetailDialogOpen(false)
            setSelectedDate(null)
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

