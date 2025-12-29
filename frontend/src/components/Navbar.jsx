import React from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Logo from './Logo'

export default function Navbar({ onMenuClick, sidebarOpen, onSidebarToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  
  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        backgroundColor: '#1976d2',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Menu Icon - Only show on mobile */}
        {user && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        {/* Sidebar Toggle Button - Only show on desktop when user is logged in */}
        {user && (
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            onClick={onSidebarToggle}
            sx={{ mr: 2, display: { xs: 'none', md: 'flex' } }}
          >
            {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        )}
        
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
        
        {/* Right-aligned buttons: Settings and Login/Logout */}
        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Settings button - Admin only */}
            {user?.role === 'admin' && (
              <Button color="inherit" onClick={() => navigate('/settings')}>
                Settings
              </Button>
            )}
            <Button color="inherit" onClick={logout}>
              Logout ({user.username})
            </Button>
          </Box>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>
            Login
          </Button>
        )}
      </Toolbar>
    </AppBar>
  )
}


