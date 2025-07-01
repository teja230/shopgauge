import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert, AlertTitle } from '@mui/material';
import { Replay } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
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
    // Typically you might also want to trigger a re-fetch or state reset in a parent component
    // For now, this just resets the boundary's state.
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" variant="filled" sx={{ mt: 2, p: 2, borderRadius: 2 }}>
            <AlertTitle>Component Error</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
                {this.props.fallbackMessage || 'This part of the application has encountered an error.'}
            </Typography>
            <Button
                variant="contained"
                color="inherit"
                size="small"
                onClick={this.handleReset}
                startIcon={<Replay />}
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