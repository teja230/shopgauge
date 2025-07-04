import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, Collapse } from '@mui/material';
import { Refresh, ExpandMore, ExpandLess } from '@mui/icons-material';
import { debugLog } from './DebugPanel';

interface Props {
  children: ReactNode;
  fallbackHeight?: number;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  showDetails: boolean;
}

class ChartErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLog.error('ChartErrorBoundary caught an error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    }, 'ChartErrorBoundary');

    this.setState({
      error,
      errorInfo,
    });

    // Auto-retry for certain types of errors (up to 3 times)
    if (this.state.retryCount < 3 && this.isRetryableError(error)) {
      this.scheduleRetry();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    // Reset error state when children change (new data)
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private isRetryableError = (error: Error): boolean => {
    const retryablePatterns = [
      'Invariant failed',
      'SVG',
      'Cannot read properties',
      'TypeError',
    ];
    
    return retryablePatterns.some(pattern => 
      error.message.includes(pattern) || error.stack?.includes(pattern)
    );
  };

  private scheduleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.retryTimeoutId = setTimeout(() => {
      debugLog.info('Auto-retrying chart render', {
        retryCount: this.state.retryCount + 1,
      }, 'ChartErrorBoundary');

      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        showDetails: false,
      }));
    }, 1000 + this.state.retryCount * 500); // Exponential backoff
  };

  private handleManualRetry = () => {
    debugLog.info('Manual retry triggered', {
      retryCount: this.state.retryCount,
    }, 'ChartErrorBoundary');

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  private toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  private getErrorMessage = (error: Error): string => {
    if (error.message.includes('Invariant failed')) {
      return 'Chart rendering failed due to invalid data. This is usually caused by incompatible data values.';
    }
    if (error.message.includes('SVG')) {
      return 'Chart rendering failed due to SVG compatibility issues.';
    }
    if (error.message.includes('Cannot read properties')) {
      return 'Chart rendering failed due to missing data properties.';
    }
    return 'An unexpected error occurred while rendering the chart.';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallbackHeight = 400 } = this.props;
      const errorMessage = this.getErrorMessage(this.state.error);

      return (
        <Box
          sx={{
            height: fallbackHeight,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            backgroundColor: 'rgba(255, 245, 245, 0.5)',
            borderRadius: 2,
            border: '1px solid rgba(255, 0, 0, 0.1)',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="error" textAlign="center">
            Chart Failed to Load
          </Typography>
          
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 400 }}>
            {errorMessage}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={this.handleManualRetry}
              size="small"
            >
              Retry Chart
            </Button>
            
            <Button
              variant="outlined"
              startIcon={this.state.showDetails ? <ExpandLess /> : <ExpandMore />}
              onClick={this.toggleDetails}
              size="small"
            >
              {this.state.showDetails ? 'Hide' : 'Show'} Details
            </Button>
          </Box>

          <Collapse in={this.state.showDetails} sx={{ width: '100%', maxWidth: 600 }}>
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" component="div">
                <strong>Error:</strong> {this.state.error.message}
              </Typography>
              {this.state.retryCount > 0 && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Auto-retry attempts: {this.state.retryCount}
                </Typography>
              )}
              <Typography variant="caption" display="block" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                {this.state.error.stack?.split('\n').slice(0, 3).join('\n')}
              </Typography>
            </Alert>
          </Collapse>

          <Typography variant="caption" color="text.secondary" textAlign="center">
            If this issue persists, try refreshing the page or contact support.
          </Typography>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;