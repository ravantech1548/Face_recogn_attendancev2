import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Paper, 
  Grid, 
  Alert, 
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import API_BASE_URL from '../config/api'

export default function AddStaff() {
  const navigate = useNavigate()
  const { staffId } = useParams()
  const queryClient = useQueryClient()
  const isEditing = Boolean(staffId)

  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm()
  const [createLogin, setCreateLogin] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  
  // New work-related fields
  const [workStatus, setWorkStatus] = useState('Full-time')
  const [manager, setManager] = useState('')
  const [workFromHomeEnabled, setWorkFromHomeEnabled] = useState(false)
  const [onDutyEnabled, setOnDutyEnabled] = useState(true)
  const [workStartTime, setWorkStartTime] = useState('09:15')
  const [workEndTime, setWorkEndTime] = useState('17:45')
  const [breakTimeMinutes, setBreakTimeMinutes] = useState(30)
  const [supervisorName, setSupervisorName] = useState('')
  const [projectCode, setProjectCode] = useState('')

  const { data: staffData, isLoading } = useQuery(
    ['staff', staffId],
    () => axios.get(`${API_BASE_URL}/api/staff/${staffId}`).then((r) => r.data),
    { enabled: isEditing }
  )

  useEffect(() => {
    if (staffData && isEditing) {
      setValue('staffId', staffData.staff_id)
      setValue('fullName', staffData.full_name)
      setValue('email', staffData.email)
      setValue('designation', staffData.designation)
      setValue('department', staffData.department)
      if (staffData.face_image_path) setPreview(`${API_BASE_URL}/${staffData.face_image_path}`)
      
      // Set new work-related fields
      setWorkStatus(staffData.work_status || 'Full-time')
      setManager(staffData.manager || '')
      setWorkFromHomeEnabled(staffData.work_from_home_enabled || false)
      setOnDutyEnabled(staffData.on_duty_enabled !== false) // Default to true if not set
      setWorkStartTime(staffData.work_start_time ? staffData.work_start_time.slice(0, 5) : '09:15')
      setWorkEndTime(staffData.work_end_time ? staffData.work_end_time.slice(0, 5) : '17:45')
      setBreakTimeMinutes(staffData.break_time_minutes || 30)
      setSupervisorName(staffData.supervisor_name || '')
      setProjectCode(staffData.project_code || '')
    }
  }, [staffData, isEditing, setValue])

  const mutation = useMutation(
    (formData) => {
      if (isEditing) return axios.put(`${API_BASE_URL}/api/staff/${staffId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      return axios.post(`${API_BASE_URL}/api/staff`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('staff')
        toast.success(`Staff ${isEditing ? 'updated' : 'added'} successfully`)
        navigate('/staff')
      },
      onError: (err) => toast.error(err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'add'} staff`),
    }
  )

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    setSelectedFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  function onSubmit(data) {
    const formData = new FormData()
    formData.append('staffId', data.staffId)
    formData.append('fullName', data.fullName)
    formData.append('email', data.email)
    formData.append('designation', data.designation)
    formData.append('department', data.department)
    
    // Add new work-related fields
    formData.append('workStatus', workStatus)
    formData.append('manager', manager)
    formData.append('workFromHomeEnabled', workFromHomeEnabled)
    formData.append('onDutyEnabled', onDutyEnabled)
    formData.append('workStartTime', workStartTime + ':00')
    formData.append('workEndTime', workEndTime + ':00')
    formData.append('breakTimeMinutes', breakTimeMinutes)
    formData.append('supervisorName', supervisorName)
    formData.append('projectCode', projectCode)
    
    if (selectedFile) formData.append('faceImage', selectedFile)
    mutation.mutate(formData, {
      onSuccess: async () => {
        if (!isEditing && createLogin && loginUsername && loginPassword) {
          try {
            const token = localStorage.getItem('token')
            await axios.post(`${API_BASE_URL}/api/users`, {
              username: loginUsername,
              password: loginPassword,
              role: 'user',
              staffId: data.staffId,
            }, {
              headers: { Authorization: `Bearer ${token}` }
            })
            toast.success('Login created for staff')
          } catch (e) {
            toast.error('Failed to create login')
          }
        }
      }
    })
  }

  if (isLoading) return <Typography sx={{ p: 3 }}>Loading...</Typography>

  return (
    <Container maxWidth="md" sx={{ mt: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">{isEditing ? 'Edit Staff' : 'Add New Staff'}</Typography>
          <Button onClick={() => navigate('/staff')}>Back</Button>
        </Box>
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Staff ID" {...register('staffId', { required: true })} error={Boolean(errors.staffId)} helperText={errors.staffId && 'Required'} disabled={isEditing} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Full Name" {...register('fullName', { required: true })} error={Boolean(errors.fullName)} helperText={errors.fullName && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Email" {...register('email', { required: true })} error={Boolean(errors.email)} helperText={errors.email && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Designation" {...register('designation', { required: true })} error={Boolean(errors.designation)} helperText={errors.designation && 'Required'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Department" {...register('department', { required: true })} error={Boolean(errors.department)} helperText={errors.department && 'Required'} />
            </Grid>
            
            {/* Work-related fields section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }}>
                <Typography variant="h6" color="primary">Work Information</Typography>
              </Divider>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Work Status</InputLabel>
                <Select
                  value={workStatus}
                  label="Work Status"
                  onChange={(e) => setWorkStatus(e.target.value)}
                >
                  <MenuItem value="Full-time">Full-time</MenuItem>
                  <MenuItem value="Part-time">Part-time</MenuItem>
                  <MenuItem value="Contract">Contract</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Manager" 
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="Manager's full name"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Supervisor Name" 
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Supervisor's full name"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Project Code" 
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="Project or department code"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={workFromHomeEnabled}
                    onChange={(e) => setWorkFromHomeEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Work From Home Enabled"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={onDutyEnabled}
                    onChange={(e) => setOnDutyEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="ON DUTY Enabled"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Break Time</InputLabel>
                <Select
                  value={breakTimeMinutes}
                  label="Break Time"
                  onChange={(e) => setBreakTimeMinutes(e.target.value)}
                >
                  <MenuItem value={30}>30 minutes</MenuItem>
                  <MenuItem value={60}>1 hour</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Work Start Time"
                type="time"
                value={workStartTime}
                onChange={(e) => setWorkStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Work End Time"
                type="time"
                value={workEndTime}
                onChange={(e) => setWorkEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button variant="outlined" component="label">
                Choose Face Image
                <input hidden accept="image/*" type="file" onChange={handleFileChange} />
              </Button>
              {preview && <Avatar src={preview} sx={{ width: 80, height: 80, ml: 2, display: 'inline-flex', verticalAlign: 'middle' }} />}
            </Grid>
            {!isEditing && (
              <>
                <Grid item xs={12}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <label>
                      <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} /> Create login for this staff
                    </label>
                  </Box>
                </Grid>
                {createLogin && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Login Username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Login Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                    </Grid>
                  </>
                )}
              </>
            )}
          </Grid>
          <Box mt={3} display="flex" gap={2}>
            <Button type="submit" variant="contained" disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Saving...' : isEditing ? 'Update Staff' : 'Add Staff'}
            </Button>
            <Button variant="text" onClick={() => navigate('/staff')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  )
}


