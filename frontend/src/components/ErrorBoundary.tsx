import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert, AlertTitle } from '@mui/material';
import { Replay } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });

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
      return (
        <Alert
          severity="error"
          variant="outlined"
          sx={(theme) => ({
            mt: 2,
            p: 2,
            borderRadius: 1,
            borderWidth: 1,
            borderColor: theme.palette.error.light,
            backgroundColor: theme.palette.mode === 'dark'
              ? theme.palette.error.dark + '08'
              : theme.palette.error.light + '08',
            color: theme.palette.text.primary,
            [theme.breakpoints.down('sm')]: {
              p: 1.5,
              borderRadius: 0.5,
            },
          })}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {this.props.fallbackMessage || 'This part of the application has encountered an error.'}
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

    return this.props.children;
  }
}

export default ErrorBoundary; 