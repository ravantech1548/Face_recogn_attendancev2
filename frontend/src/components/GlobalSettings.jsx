import React, { useState } from 'react'
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
} from '@mui/material'
import { Add, Edit, Delete, Refresh } from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

export default function GlobalSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState({})
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Fetch settings
  const { data: settingsData, isLoading } = useQuery(
    'settings',
    async () => {
      const res = await axios.get(`${API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    {
      onSuccess: (data) => {
        setSettings(data)
      },
      onError: (error) => {
        console.error('Settings query error:', error)
        toast.error('Failed to load settings: ' + (error.response?.data?.message || error.message))
      }
    }
  )

  // Update setting mutation
  const updateSetting = useMutation(
    async ({ key, value }) => {
      return axios.put(
        `${API_BASE_URL}/api/settings/${key}`,
        { value },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      )
    },
    {
      onSuccess: (response, variables) => {
        toast.success(`Setting "${variables.key}" updated successfully`)
        queryClient.invalidateQueries('settings')
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update setting')
      }
    }
  )

  const handleSettingChange = (key, newValue) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: newValue
      }
    }))
  }

  const handleSaveSetting = (key) => {
    const setting = settings[key]
    if (!setting) return
    
    // Validate number inputs
    if (setting.type === 'number') {
      const numValue = parseFloat(setting.value)
      if (isNaN(numValue) || numValue < 0) {
        toast.error('Please enter a valid positive number')
        return
      }
    }
    
    updateSetting.mutate({ key, value: setting.value })
  }

  // Fetch holidays
  const { data: holidays = [], isLoading: holidaysLoading, refetch: refetchHolidays } = useQuery(
    ['holidays', selectedYear],
    async () => {
      const res = await axios.get(`${API_BASE_URL}/api/calendar/holidays`, {
        params: { year: selectedYear },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      return res.data
    },
    {
      enabled: !isLoading && Object.keys(settings).length > 0, // Only fetch if settings are loaded
      onError: (error) => {
        console.error('Holidays query error:', error)
        // Don't show error if calendar table doesn't exist yet (404) or if it's a network error
        if (error.response?.status !== 404 && error.response?.status !== 500) {
          // Only show error for other types of errors
          if (error.code !== 'ERR_NETWORK') {
            toast.error('Failed to load holidays: ' + (error.response?.data?.message || error.message))
          }
        }
      }
    }
  )

  // Add/Update holiday mutation
  const holidayMutation = useMutation(
    async ({ date, holidayName }) => {
      if (editingHoliday) {
        return axios.put(
          `${API_BASE_URL}/api/calendar/holidays/${date}`,
          { holidayName },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
      } else {
        return axios.post(
          `${API_BASE_URL}/api/calendar/holidays`,
          { date, holidayName },
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        )
      }
    },
    {
      onSuccess: () => {
        toast.success(editingHoliday ? 'Holiday updated successfully' : 'Holiday added successfully')
        queryClient.invalidateQueries(['holidays', selectedYear])
        setHolidayDialogOpen(false)
        setEditingHoliday(null)
        setHolidayDate('')
        setHolidayName('')
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to save holiday')
      }
    }
  )

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation(
    async (date) => {
      return axios.delete(
        `${API_BASE_URL}/api/calendar/holidays/${date}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
    },
    {
      onSuccess: () => {
        toast.success('Holiday deleted successfully')
        queryClient.invalidateQueries(['holidays', selectedYear])
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to delete holiday')
      }
    }
  )

  // Refresh weekend config mutation
  const refreshWeekendMutation = useMutation(
    async () => {
      return axios.post(
        `${API_BASE_URL}/api/calendar/weekend-config/refresh`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
    },
    {
      onSuccess: () => {
        toast.success('Weekend configuration refreshed successfully')
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to refresh weekend configuration')
      }
    }
  )

  const handleOpenHolidayDialog = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday)
      setHolidayDate(holiday.calendar_date)
      setHolidayName(holiday.holiday_name)
    } else {
      setEditingHoliday(null)
      setHolidayDate('')
      setHolidayName('')
    }
    setHolidayDialogOpen(true)
  }

  const handleCloseHolidayDialog = () => {
    setHolidayDialogOpen(false)
    setEditingHoliday(null)
    setHolidayDate('')
    setHolidayName('')
  }

  const handleSaveHoliday = () => {
    if (!holidayDate || !holidayName.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    holidayMutation.mutate({ date: holidayDate, holidayName: holidayName.trim() })
  }

  const handleDeleteHoliday = (date) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      deleteHolidayMutation.mutate(date)
    }
  }

  const handleWeekendSettingChange = (key, value) => {
    handleSettingChange(key, value)
    handleSaveSetting(key)
  }

  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="error">Access Denied</Typography>
          <Typography variant="body2" color="text.secondary">
            Only administrators can access global settings.
          </Typography>
        </Paper>
      </Container>
    )
  }

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading settings...
          </Typography>
        </Paper>
      </Container>
    )
  }

  const leaveSettings = [
    { key: 'leave_max_past_months', label: 'Maximum Past Months for Leave', unit: 'months' },
    { key: 'leave_max_future_months', label: 'Maximum Future Months for Leave', unit: 'months' }
  ]

  return (
    <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Global Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure system-wide settings for the attendance management system.
        </Typography>

        {/* Leave Date Range Settings */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2 }}>
            Leave Date Range Settings
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure the date range allowed for leave entries. These settings control how far in the past or future 
            leave entries can be recorded.
          </Alert>

          <Grid container spacing={3}>
            {leaveSettings.map(({ key, label, unit }) => {
              const setting = settings[key]
              if (!setting) return null
              
              return (
                <Grid item xs={12} md={6} key={key}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {label}
                    </Typography>
                    {setting.description && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                        {setting.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField
                        type="number"
                        fullWidth
                        value={setting.value || ''}
                        onChange={(e) => handleSettingChange(key, parseFloat(e.target.value) || 0)}
                        inputProps={{ min: 0, max: 24, step: 1 }}
                        InputProps={{
                          endAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>{unit}</Typography>
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={() => handleSaveSetting(key)}
                        disabled={updateSetting.isLoading}
                      >
                        {updateSetting.isLoading ? 'Saving...' : 'Save'}
                      </Button>
                    </Box>
                    {setting.value !== settingsData?.[key]?.value && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        You have unsaved changes. Click Save to apply.
                      </Alert>
                    )}
                  </Paper>
                </Grid>
              )
            })}
          </Grid>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Calendar/Holiday Management */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Calendar & Holiday Management
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Configure non-working days and manage public holidays. Sunday is set as non-working day by default, 
            while Saturday is set as working day.
          </Alert>

          {/* Weekend Configuration */}
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2 }}>
              Weekend Configuration
            </Typography>
            {!settings.sunday_as_non_working_day && !settings.saturday_as_non_working_day ? (
              <Alert severity="warning">
                Calendar settings are not configured yet. Please run the database migrations to set up calendar functionality.
                <br />
                <Typography variant="caption" component="span">
                  Run: <code>cd backend && node scripts/run_all_migration.js</code>
                </Typography>
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {settings.sunday_as_non_working_day && (
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.sunday_as_non_working_day?.value ?? true}
                          onChange={(e) => handleWeekendSettingChange('sunday_as_non_working_day', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1">Sunday as Non-Working Day</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {settings.sunday_as_non_working_day?.description || 'Enable Sunday as a weekend'}
                          </Typography>
                        </Box>
                      }
                    />
                  </Grid>
                )}
                {settings.saturday_as_non_working_day && (
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.saturday_as_non_working_day?.value ?? false}
                          onChange={(e) => handleWeekendSettingChange('saturday_as_non_working_day', e.target.checked)}
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1">Saturday as Non-Working Day</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {settings.saturday_as_non_working_day?.description || 'Enable Saturday as a weekend'}
                          </Typography>
                        </Box>
                      }
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={() => refreshWeekendMutation.mutate()}
                    disabled={refreshWeekendMutation.isLoading}
                    size="small"
                  >
                    {refreshWeekendMutation.isLoading ? 'Refreshing...' : 'Refresh Weekend Configuration'}
                  </Button>
                </Grid>
              </Grid>
            )}
          </Paper>

          {/* Public Holidays Management */}
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Public Holidays
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  type="number"
                  label="Year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  inputProps={{ min: 2024, max: 2030 }}
                  size="small"
                  sx={{ width: 100 }}
                />
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpenHolidayDialog()}
                  size="small"
                >
                  Add Holiday
                </Button>
              </Box>
            </Box>

            {holidaysLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : holidays.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No public holidays configured for {selectedYear}. Click "Add Holiday" to add one.
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Day</strong></TableCell>
                      <TableCell><strong>Holiday Name</strong></TableCell>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell align="right"><strong>Actions</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.calendar_date}>
                        <TableCell>
                          {new Date(holiday.calendar_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>{holiday.day_name}</TableCell>
                        <TableCell>{holiday.holiday_name}</TableCell>
                        <TableCell>
                          {holiday.is_weekend ? (
                            <Chip label="Weekend" size="small" color="secondary" />
                          ) : (
                            <Chip label="Holiday" size="small" color="primary" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenHolidayDialog(holiday)}
                            color="primary"
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteHoliday(holiday.calendar_date)}
                            color="error"
                            disabled={deleteHolidayMutation.isLoading}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Box>
      </Paper>

      {/* Add/Edit Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onClose={handleCloseHolidayDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingHoliday ? 'Edit Holiday' : 'Add Public Holiday'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
              disabled={!!editingHoliday}
            />
            <TextField
              label="Holiday Name"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., New Year's Day"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHolidayDialog}>Cancel</Button>
          <Button
            onClick={handleSaveHoliday}
            variant="contained"
            disabled={holidayMutation.isLoading || !holidayDate || !holidayName.trim()}
          >
            {holidayMutation.isLoading ? 'Saving...' : editingHoliday ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

