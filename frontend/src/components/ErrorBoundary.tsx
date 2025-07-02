import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { Replay } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentKey: number;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    componentKey: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Preserve the existing componentKey to avoid unnecessary remounts when the
    // error is first captured. It will be incremented on reset.
    return { hasError: true, error, componentKey: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState((prev) => ({ hasError: false, error: undefined, componentKey: prev.componentKey + 1 }));

    if (this.props.onRetry) {
      try {
        this.props.onRetry();
      } catch (e) {
        console.error('ErrorBoundary onRetry callback failed', e);
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      // Check if this is an Advanced Analytics error and show a regular page instead
      const isAdvancedAnalyticsError = this.props.fallbackMessage?.includes('Advanced Analytics');
      
      if (isAdvancedAnalyticsError) {
        return (
          <Box
            sx={{
              height: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
              backgroundColor: 'rgba(255, 0, 0, 0.02)',
              borderRadius: 2,
              border: '1px solid rgba(255, 0, 0, 0.1)',
            }}
          >
            <Typography variant="h6" color="error">
              Failed to load analytics data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The Advanced Analytics chart encountered an error. Please try refreshing the page.
            </Typography>
          </Box>
        );
      }
      
      return (
        <Alert
          severity="error"
          variant="outlined"
          sx={(theme) => ({
            mt: 2,
            p: 2,
            borderRadius: 2,
            borderWidth: 1,
            borderColor: theme.palette.error.light,
            backgroundColor: theme.palette.mode === 'dark'
              ? theme.palette.error.dark + '08'
              : theme.palette.error.light + '08',
            color: theme.palette.text.primary,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 1.5,
            [theme.breakpoints.down('sm')]: {
              p: 1.5,
              borderRadius: 1,
            },
          })}
        >
          {this.props.fallbackMessage && (
            <AlertTitle sx={{ fontWeight: 700 }}>
              {this.props.fallbackMessage}
            </AlertTitle>
          )}
          {!this.props.fallbackMessage && (
            <AlertTitle sx={{ fontWeight: 700 }}>
              Something went wrong
            </AlertTitle>
          )}
          <Typography variant="body2" color="text.secondary">
            Our team has been notified. You can try reloading this section, and if the problem persists please contact support.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={this.handleReset}
            startIcon={<Replay />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Try Again
          </Button>
        </Alert>
      );
    }

    return <React.Fragment key={this.state.componentKey}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary; 