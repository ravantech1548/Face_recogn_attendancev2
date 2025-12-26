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
} from '@mui/material'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import API_BASE_URL from '../config/api'

export default function GlobalSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState({})

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
    <Container maxWidth="lg" sx={{ mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Global Settings
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure system-wide settings for the attendance management system.
        </Typography>

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
      </Paper>
    </Container>
  )
}

