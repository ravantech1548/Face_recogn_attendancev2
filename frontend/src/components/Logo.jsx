import React from 'react'
import { Box, Typography } from '@mui/material'
import logoImage from '../assets/q-logo.svg'

export default function Logo({ variant = 'full', size = 'medium' }) {
  const sizes = {
    small: {
      logoSize: 30,
      taglineFontSize: '8px',
      companyFontSize: '16px'
    },
    medium: {
      logoSize: 45,
      taglineFontSize: '10px',
      companyFontSize: '20px'
    },
    large: {
      logoSize: 60,
      taglineFontSize: '11px',
      companyFontSize: '24px'
    }
  }

  const s = sizes[size]

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {/* Q Automation Logo Image */}
      <Box
        component="img"
        src={logoImage}
        alt="Q Automation Logo"
        sx={{
          width: s.logoSize,
          height: s.logoSize,
          flexShrink: 0,
          objectFit: 'contain'
        }}
      />

      {/* Company Info */}
      {variant === 'full' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Typography
            sx={{
              color: '#FF6B35',
              fontWeight: 'bold',
              fontSize: s.companyFontSize,
              fontFamily: 'serif',
              lineHeight: 1.2,
              whiteSpace: 'nowrap'
            }}
          >
            Q Automation
          </Typography>
          <Typography
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: s.taglineFontSize,
              fontFamily: 'sans-serif',
              letterSpacing: '0.5px',
              fontWeight: 500,
              lineHeight: 1
            }}
          >
            INNOVATION UNLIMITED
          </Typography>
        </Box>
      )}

      {variant === 'compact' && (
        <Typography
          sx={{
            color: 'white',
            fontWeight: 'bold',
            fontSize: s.companyFontSize,
            fontFamily: 'serif',
            whiteSpace: 'nowrap'
          }}
        >
          Q Automation
        </Typography>
      )}
    </Box>
  )
}

