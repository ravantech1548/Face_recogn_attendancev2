import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Toolbar,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  People as PeopleIcon,
  Face as FaceIcon,
  Assessment as AssessmentIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
} from '@mui/icons-material'

const drawerWidth = 240

export default function Sidebar({ open, onClose, sidebarOpen = true }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const menuItems = []

  // Admin-only menu items
  if (user?.role === 'admin') {
    menuItems.push(
      {
        text: 'Staff',
        path: '/staff',
        icon: <PeopleIcon />,
      },
      {
        text: 'Face Attendance',
        path: '/attendance/face',
        icon: <FaceIcon />,
      },
      {
        text: 'Attendance Report',
        path: '/attendance',
        icon: <AssessmentIcon />,
      },
      {
        text: 'Attendance and Leave Actions',
        path: '/attendance-actions',
        icon: <AssignmentIcon />,
      }
    )
  }

  // Operator-only menu items
  if (user?.role === 'operator') {
    menuItems.push(
      {
        text: 'Face Attendance',
        path: '/attendance/face',
        icon: <FaceIcon />,
      },
      {
        text: 'View Reports',
        path: '/attendance',
        icon: <AssessmentIcon />,
      }
    )
  }

  const handleNavigation = (path) => {
    navigate(path)
    if (isMobile && open) {
      onClose()
    }
  }

  const drawerContent = (
    <Box>
      <Toolbar />
      <List>
        {menuItems.map((item) => {
          // Determine active state: only the most specific (longest) matching path should be active
          // First, find all matching menu items
          const matchingItems = menuItems.filter(menuItem => {
            if (location.pathname === menuItem.path) {
              return true // Exact match
            }
            // Check if current pathname starts with menu item path
            // and is followed by '/' or end of string (to avoid partial matches)
            if (location.pathname.startsWith(menuItem.path)) {
              const nextChar = location.pathname[menuItem.path.length]
              return nextChar === undefined || nextChar === '/' || nextChar === '?'
            }
            return false
          })
          
          // If there are multiple matches, use the longest path (most specific)
          const longestMatch = matchingItems.length > 0
            ? matchingItems.reduce((longest, current) => 
                current.path.length > longest.path.length ? current : longest
              )
            : null
          
          // This item is active only if it's the longest matching path
          const isActive = longestMatch !== null && item.path === longestMatch.path
          
          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main,
                    color: 'white',
                    '&:hover': {
                      backgroundColor: theme.palette.primary.dark,
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                  },
                  '&:hover': {
                    backgroundColor: isActive 
                      ? theme.palette.primary.dark 
                      : theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? 'white' : 'inherit',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )

  // Mobile drawer (temporary)
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {drawerContent}
      </Drawer>
    )
  }

  // Desktop drawer (permanent, can be collapsed)
  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        width: sidebarOpen ? drawerWidth : 0,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        '& .MuiDrawer-paper': {
          width: sidebarOpen ? drawerWidth : 0,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
      open={sidebarOpen}
    >
      {sidebarOpen && drawerContent}
    </Drawer>
  )
}

export { drawerWidth }

