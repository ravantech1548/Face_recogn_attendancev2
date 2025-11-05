import React from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  
  return (
    <AppBar position="static" sx={{ backgroundColor: '#1976d2' }}>
      <Toolbar sx={{ gap: 2 }}>
        {/* Q Automation Logo - Top Left */}
        <Box 
          sx={{ 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }} 
          onClick={() => navigate('/')}
        >
          <Logo variant="compact" size="medium" />
        </Box>
        
        {/* Divider */}
        <Box 
          sx={{ 
            height: 40, 
            width: 2, 
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            display: { xs: 'none', sm: 'block' }
          }} 
        />
        
        {/* Application Title */}
        <Typography 
          variant="h6" 
          sx={{ 
            flexGrow: 1, 
            cursor: 'pointer',
            color: 'white',
            fontWeight: 500,
            fontSize: { xs: '1rem', sm: '1.25rem' }
          }} 
          onClick={() => navigate('/')}
        >
          {user?.role === 'operator' ? 'Face Recognition System' : 'Face Attendance Admin'}
        </Typography>
        {user ? (
          <Box>
            {/* Admin-only links */}
            {user?.role === 'admin' && (
              <>
                <Button color="inherit" onClick={() => navigate('/staff')}>Staff</Button>
                <Button color="inherit" onClick={() => navigate('/attendance/face')}>Face Attendance</Button>
                <Button color="inherit" onClick={() => navigate('/attendance')}>Attendance Report</Button>
              </>
            )}
            
            {/* Operator-only links */}
            {user?.role === 'operator' && (
              <>
                <Button color="inherit" onClick={() => navigate('/attendance/face')}>Face Attendance</Button>
                <Button color="inherit" onClick={() => navigate('/attendance')}>View Reports</Button>
              </>
            )}
            
            <Button color="inherit" onClick={logout}>Logout ({user.username})</Button>
          </Box>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
        )}
      </Toolbar>
    </AppBar>
  )
}


