import React, { Component, type ReactNode } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Alert, 
  AlertTitle, 
  Card, 
  CardContent,
  Stack,
  Chip,
  Collapse,
  IconButton
} from '@mui/material';
import { 
  Replay as ReplayIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugReportIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Types
interface Props {
  children: ReactNode;
  sectionName: string;
  fallbackMessage?: string;
  onRetry?: () => void;
  showErrorDetails?: boolean;
  isolateError?: boolean;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  componentKey: number;
  showDetails: boolean;
}

// Styled Components
const ErrorContainer = styled(Card)(({ theme }) => ({
  border: `1px solid ${theme.palette.error.light}`,
  backgroundColor: theme.palette.error.light + '08',
  borderRadius: 12,
  overflow: 'hidden',
}));

const ErrorHeader = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.error.light + '20',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.error.light}`,
}));

const ErrorContent = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(3),
  '&:last-child': {
    paddingBottom: theme.spacing(3),
  },
}));

const ErrorDetailsContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  border: `1px solid ${theme.palette.grey[200]}`,
  borderRadius: 8,
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  maxHeight: 200,
  overflow: 'auto',
}));

// Error severity levels
const getErrorSeverity = (error?: Error) => {
  if (!error) return 'medium';
  
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || '';
  
  // High severity - critical system errors
  if (
    message.includes('chunk') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    stack.includes('auth')
  ) {
    return 'high';
  }
  
  // Low severity - UI/rendering errors
  if (
    message.includes('render') ||
    message.includes('prop') ||
    message.includes('component') ||
    stack.includes('react')
  ) {
    return 'low';
  }
  
  return 'medium';
};

// Get user-friendly error message
const getUserFriendlyMessage = (error?: Error, sectionName?: string) => {
  if (!error) return `Something went wrong in the ${sectionName} section.`;
  
  const message = error.message.toLowerCase();
  
  if (message.includes('chunk') || message.includes('loading')) {
    return 'Failed to load this section. This might be due to a network issue or an app update.';
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network connection issue. Please check your internet connection.';
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. The server might be busy or your connection is slow.';
  }
  
  if (message.includes('auth') || message.includes('unauthorized')) {
    return 'Authentication error. Please refresh the page and try again.';
  }
  
  if (message.includes('not found') || message.includes('404')) {
    return 'The requested resource was not found. It might have been moved or deleted.';
  }
  
  return `An error occurred in the ${sectionName} section. Please try refreshing or contact support if the issue persists.`;
};

// Get recovery suggestions
const getRecoverySuggestions = (error?: Error) => {
  if (!error) return [];
  
  const message = error.message.toLowerCase();
  const suggestions = [];
  
  if (message.includes('chunk') || message.includes('loading')) {
    suggestions.push('Refresh the page to reload the latest version');
    suggestions.push('Clear your browser cache and try again');
  }
  
  if (message.includes('network') || message.includes('fetch')) {
    suggestions.push('Check your internet connection');
    suggestions.push('Try again in a few moments');
    suggestions.push('Disable any VPN or proxy if enabled');
  }
  
  if (message.includes('timeout')) {
    suggestions.push('Wait a moment and try again');
    suggestions.push('Check if the server is experiencing high load');
  }
  
  if (message.includes('auth')) {
    suggestions.push('Refresh the page to re-authenticate');
    suggestions.push('Log out and log back in');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Try refreshing the page');
    suggestions.push('Contact support if the issue persists');
  }
  
  return suggestions;
};

class SectionErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;
  
  public state: State = {
    hasError: false,
    componentKey: 0,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true, 
      error 
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log error details for debugging
    console.group(`🚨 Error in ${this.props.sectionName} section`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.groupEnd();
    
    // Report to error tracking service (if available)
    if ((window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: `${this.props.sectionName}: ${error.message}`,
        fatal: this.props.level === 'page',
        section: this.props.sectionName,
        error_boundary: true,
      });
    }
  }

  private handleRetry = () => {
    this.retryCount++;
    
    console.log(`🔄 Retrying ${this.props.sectionName} section (attempt ${this.retryCount})`);
    
    this.setState(prev => ({ 
      hasError: false, 
      error: undefined,
      errorInfo: undefined,
      componentKey: prev.componentKey + 1,
      showDetails: false,
    }));

    // Call custom retry handler if provided
    if (this.props.onRetry) {
      try {
        this.props.onRetry();
      } catch (e) {
        console.error('Custom retry handler failed:', e);
      }
    }
  };

  private handleShowDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  private handleReportIssue = () => {
    const { error, errorInfo } = this.state;
    const { sectionName } = this.props;
    
    // Create error report
    const errorReport = {
      section: sectionName,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    
    // Copy to clipboard for easy reporting
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2)).then(() => {
      console.log('Error report copied to clipboard');
    });
    
    // You could also send this to your error reporting service
    console.log('Error Report:', errorReport);
  };

  public render() {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { 
      children, 
      sectionName, 
      fallbackMessage, 
      showErrorDetails = true,
      isolateError = true,
      level = 'section'
    } = this.props;

    if (hasError) {
      const severity = getErrorSeverity(error);
      const userMessage = fallbackMessage || getUserFriendlyMessage(error, sectionName);
      const suggestions = getRecoverySuggestions(error);
      const canRetry = this.retryCount < this.maxRetries;
      
      // For component-level errors, show a minimal inline error
      if (level === 'component') {
        return (
          <Alert 
            severity="error" 
            variant="outlined"
            action={
              canRetry && (
                <Button size="small" onClick={this.handleRetry} startIcon={<ReplayIcon />}>
                  Retry
                </Button>
              )
            }
            sx={{ my: 1 }}
          >
            <AlertTitle>Error in {sectionName}</AlertTitle>
            {userMessage}
          </Alert>
        );
      }
      
      return (
        <ErrorContainer>
          <ErrorHeader>
            <Stack direction="row" alignItems="center" spacing={2}>
              <WarningIcon color="error" />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
                  {level === 'page' ? 'Page Error' : `${sectionName} Section Error`}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip 
                    label={severity.toUpperCase()} 
                    size="small" 
                    color={severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info'}
                    variant="outlined"
                  />
                  {this.retryCount > 0 && (
                    <Chip 
                      label={`${this.retryCount} retries`} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>
              
              {showErrorDetails && (
                <IconButton 
                  size="small" 
                  onClick={this.handleShowDetails}
                  sx={{ color: 'error.main' }}
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </Stack>
          </ErrorHeader>
          
          <ErrorContent>
            <Typography variant="body1" color="text.primary" sx={{ mb: 2 }}>
              {userMessage}
            </Typography>
            
            {suggestions.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                  Try these solutions:
                </Typography>
                <Stack spacing={1}>
                  {suggestions.map((suggestion, index) => (
                    <Typography key={index} variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                      • {suggestion}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
            
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {canRetry && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={this.handleRetry}
                  startIcon={<ReplayIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Try Again
                </Button>
              )}
              
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.location.reload()}
                sx={{ textTransform: 'none' }}
              >
                Refresh Page
              </Button>
              
              {showErrorDetails && (
                <Button
                  variant="text"
                  size="small"
                  onClick={this.handleReportIssue}
                  startIcon={<BugReportIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Report Issue
                </Button>
              )}
            </Stack>
            
            {/* Error Details */}
            {showErrorDetails && (
              <Collapse in={showDetails}>
                <ErrorDetailsContainer>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Technical Details:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Error:</strong> {error?.name || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Message:</strong> {error?.message || 'No message'}
                  </Typography>
                  {error?.stack && (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Stack Trace:</strong>
                      </Typography>
                      <Box 
                        component="pre" 
                        sx={{ 
                          fontSize: '0.75rem', 
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          maxHeight: 150,
                          overflow: 'auto',
                          bgcolor: 'grey.100',
                          p: 1,
                          borderRadius: 1,
                        }}
                      >
                        {error.stack}
                      </Box>
                    </Box>
                  )}
                </ErrorDetailsContainer>
              </Collapse>
            )}
          </ErrorContent>
        </ErrorContainer>
      );
    }

    return (
      <React.Fragment key={this.state.componentKey}>
        {children}
      </React.Fragment>
    );
  }
}

export default SectionErrorBoundary;