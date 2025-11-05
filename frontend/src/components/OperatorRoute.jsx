import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * OperatorRoute Component
 * Protects routes that require admin OR operator role
 * Typically used for face attendance/recognition features
 */
export default function OperatorRoute({ component: Component }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return null
  }
  
  if (!user) {
    return <Navigate to="/login" />
  }
  
  // Allow both admin and operator roles
  if (user.role !== 'admin' && user.role !== 'operator') {
    return <Navigate to="/attendance" />
  }
  
  return <Component />
}

