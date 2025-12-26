import React from 'react'
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
import Footer from './components/Footer'
import { AuthProvider } from './context/AuthContext'
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

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <Navbar />
              <Box component="main" sx={{ flexGrow: 1 }}>
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
              <Footer />
              <Toaster position="top-right" />
            </Box>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}


