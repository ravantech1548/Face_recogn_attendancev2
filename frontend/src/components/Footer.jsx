import React from 'react'
import { Box, Container, Typography, Divider } from '@mui/material'
import Logo from './Logo'

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 3,
        px: 2,
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #e0e0e0'
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Company Logo and Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Logo variant="full" size="large" />
            <Box sx={{ ml: 2 }}>
              <Typography
                variant="body1"
                sx={{
                  color: '#FF6B35',
                  fontFamily: 'serif',
                  fontWeight: 500,
                  fontSize: '16px'
                }}
              >
                Product Design Services
              </Typography>
            </Box>
          </Box>

          {/* Industries Bar */}
          <Box
            sx={{
              backgroundColor: '#2c3e50',
              py: 1,
              px: 2,
              borderRadius: 1
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: 'white',
                fontFamily: 'serif',
                textAlign: 'center',
                fontSize: '13px',
                letterSpacing: '0.5px'
              }}
            >
              Textile // Packing // Medical // Automotive // IoT
            </Typography>
          </Box>

          <Divider />

          {/* Copyright */}
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ fontSize: '12px' }}
          >
            © {new Date().getFullYear()} Q Automation. All rights reserved. | Face Recognition Attendance System
          </Typography>
        </Box>
      </Container>
    </Box>
  )
}

