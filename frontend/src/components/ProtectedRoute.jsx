import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ component: Component }) {
  const { user, loading } = useAuth()
  
  console.log('ProtectedRoute:', { user, loading })
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    )
  }
  
  if (!user) {
    console.log('No user found, redirecting to login')
    return <Navigate to="/login" />
  }
  
  console.log('User authenticated, rendering component')
  return <Component />
}


