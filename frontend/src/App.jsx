import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { Box } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'react-hot-toast'

import Login from './components/Login'
import StaffManagement from './components/StaffManagement'
import AddStaff from './components/AddStaff'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import OperatorRoute from './components/OperatorRoute'
import HomeRedirect from './components/HomeRedirect'
import Navbar from './components/Navbar'
import Sidebar, { drawerWidth } from './components/Sidebar'
import Footer from './components/Footer'
import { AuthProvider, useAuth } from './context/AuthContext'
import AttendanceReport from './components/AttendanceReport'
import AdminFaceAttendance from './components/AdminFaceAttendance'
import ErrorBoundary from './components/ErrorBoundary'
import GlobalSettings from './components/GlobalSettings'
import AttendanceAndLeaveActions from './components/AttendanceAndLeaveActions'

const queryClient = new QueryClient()

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
})

function AppContent() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true) // Desktop sidebar state

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar 
        onMenuClick={handleDrawerToggle} 
        sidebarOpen={sidebarOpen}
        onSidebarToggle={handleSidebarToggle}
      />
      <Box sx={{ display: 'flex', flexGrow: 1, mt: '64px' }}>
        {/* Sidebar - Only show if user is logged in */}
        {user && (
          <Sidebar 
            open={mobileOpen} 
            onClose={handleDrawerToggle}
            sidebarOpen={sidebarOpen}
          />
        )}
        {/* Main content area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { 
              md: user 
                ? `calc(100% - ${sidebarOpen ? drawerWidth : 0}px)` 
                : '100%' 
            },
            transition: (theme) => theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute component={HomeRedirect} />} />
            <Route path="/staff" element={<AdminRoute component={StaffManagement} />} />
            <Route path="/staff/add" element={<AdminRoute component={AddStaff} />} />
            <Route path="/staff/edit/:staffId" element={<AdminRoute component={AddStaff} />} />
            <Route
              path="/attendance"
              element={
                <ErrorBoundary>
                  <ProtectedRoute component={AttendanceReport} />
                </ErrorBoundary>
              }
            />
            <Route
              path="/attendance/face"
              element={<OperatorRoute component={AdminFaceAttendance} />}
            />
            <Route path="/settings" element={<AdminRoute component={GlobalSettings} />} />
            <Route path="/attendance-actions" element={<AdminRoute component={AttendanceAndLeaveActions} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Box>
      </Box>
      <Footer />
      <Toaster position="top-right" />
    </Box>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}


