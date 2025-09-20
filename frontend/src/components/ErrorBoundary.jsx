import React from 'react'
import { Container, Paper, Typography, Button, Box } from '@mui/material'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          <Paper sx={{ p: 4 }}>
            <Typography variant="h4" color="error" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" paragraph>
              An error occurred while loading the attendance report. Please try refreshing the page.
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </Box>
            
            {process.env.NODE_ENV === 'development' && (
              <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>Error Details (Development):</Typography>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Paper>
        </Container>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
