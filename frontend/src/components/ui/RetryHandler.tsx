import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  AlertTitle,
  LinearProgress,
  Stack,
  Chip,
  IconButton,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import {
  Replay as RetryIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Types
interface RetryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (attempt: number) => void;
  onSuccess?: () => void;
  onMaxAttemptsReached?: (error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  currentAttempt: number;
  nextRetryIn: number;
  lastError?: Error;
  hasSucceeded: boolean;
  isCancelled: boolean;
}

interface RetryHandlerProps {
  operation: () => Promise<any>;
  config?: RetryConfig;
  trigger?: boolean;
  onStateChange?: (state: RetryState) => void;
  showUI?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
}

// Styled Components
const RetryContainer = styled(Card)(({ theme }) => ({
  border: `1px solid ${theme.palette.warning.light}`,
  backgroundColor: theme.palette.warning.light + '08',
  borderRadius: 12,
}));

const RetryProgress = styled(LinearProgress)(({ theme }) => ({
  height: 6,
  borderRadius: 3,
  backgroundColor: theme.palette.grey[200],
  '& .MuiLinearProgress-bar': {
    borderRadius: 3,
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
  },
}));

// Default retry configuration
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('5') ||
      message.includes('server error') ||
      message.includes('service unavailable')
    );
  },
  onRetry: () => {},
  onSuccess: () => {},
  onMaxAttemptsReached: () => {},
};

// Calculate delay with exponential backoff
const calculateDelay = (attempt: number, config: Required<RetryConfig>): number => {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
};

// Format time remaining
const formatTimeRemaining = (seconds: number): string => {
  if (seconds < 1) return 'now';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.ceil(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

// Get error category for better UX
const getErrorCategory = (error: Error): 'network' | 'server' | 'client' | 'unknown' => {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'network';
  }
  
  if (message.includes('5') || message.includes('server') || message.includes('service')) {
    return 'server';
  }
  
  if (message.includes('4') || message.includes('unauthorized') || message.includes('forbidden')) {
    return 'client';
  }
  
  return 'unknown';
};

// Get user-friendly error message
const getUserFriendlyErrorMessage = (error: Error): string => {
  const category = getErrorCategory(error);
  
  switch (category) {
    case 'network':
      return 'Network connection issue. Please check your internet connection.';
    case 'server':
      return 'Server is temporarily unavailable. We\'ll keep trying.';
    case 'client':
      return 'Authentication or permission error. Please refresh the page.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

// Custom hook for retry logic
export const useRetryHandler = (
  operation: () => Promise<any>,
  config: RetryConfig = {}
) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    currentAttempt: 0,
    nextRetryIn: 0,
    hasSucceeded: false,
    isCancelled: false,
  });
  
  const [countdownTimer, setCountdownTimer] = useState<NodeJS.Timeout | null>(null);
  const [retryTimer, setRetryTimer] = useState<NodeJS.Timeout | null>(null);
  
  const cleanup = useCallback(() => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      setCountdownTimer(null);
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      setRetryTimer(null);
    }
  }, [countdownTimer, retryTimer]);
  
  const executeOperation = useCallback(async (attempt: number = 1): Promise<any> => {
    setState(prev => ({
      ...prev,
      isRetrying: true,
      currentAttempt: attempt,
      nextRetryIn: 0,
      isCancelled: false,
    }));
    
    try {
      fullConfig.onRetry(attempt);
      const result = await operation();
      
      setState(prev => ({
        ...prev,
        isRetrying: false,
        hasSucceeded: true,
        lastError: undefined,
      }));
      
      fullConfig.onSuccess();
      cleanup();
      return result;
    } catch (error) {
      const err = error as Error;
      
      setState(prev => ({
        ...prev,
        isRetrying: false,
        lastError: err,
      }));
      
      // Check if we should retry
      const shouldRetry = fullConfig.retryCondition(err) && attempt < fullConfig.maxAttempts;
      
      if (shouldRetry) {
        const delay = calculateDelay(attempt, fullConfig);
        
        setState(prev => ({
          ...prev,
          nextRetryIn: delay / 1000,
        }));
        
        // Start countdown
        const countdown = setInterval(() => {
          setState(prev => {
            const newTime = prev.nextRetryIn - 0.1;
            if (newTime <= 0) {
              clearInterval(countdown);
              return { ...prev, nextRetryIn: 0 };
            }
            return { ...prev, nextRetryIn: newTime };
          });
        }, 100);
        setCountdownTimer(countdown);
        
        // Schedule retry
        const retry = setTimeout(() => {
          executeOperation(attempt + 1);
        }, delay);
        setRetryTimer(retry);
      } else {
        fullConfig.onMaxAttemptsReached(err);
      }
      
      throw err;
    }
  }, [operation, fullConfig, cleanup]);
  
  const retry = useCallback(() => {
    cleanup();
    executeOperation(1);
  }, [executeOperation, cleanup]);
  
  const cancel = useCallback(() => {
    cleanup();
    setState(prev => ({
      ...prev,
      isRetrying: false,
      isCancelled: true,
      nextRetryIn: 0,
    }));
  }, [cleanup]);
  
  const reset = useCallback(() => {
    cleanup();
    setState({
      isRetrying: false,
      currentAttempt: 0,
      nextRetryIn: 0,
      hasSucceeded: false,
      isCancelled: false,
    });
  }, [cleanup]);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    state,
    execute: executeOperation,
    retry,
    cancel,
    reset,
  };
};

// Main RetryHandler Component
const RetryHandler: React.FC<RetryHandlerProps> = ({
  operation,
  config = {},
  trigger = false,
  onStateChange,
  showUI = true,
  compact = false,
  title = "Operation Failed",
  description,
}) => {
  const { state, execute, retry, cancel } = useRetryHandler(operation, config);
  const [showDetails, setShowDetails] = useState(false);
  
  // Execute operation when triggered
  useEffect(() => {
    if (trigger && !state.isRetrying && !state.hasSucceeded) {
      execute();
    }
  }, [trigger, execute, state.isRetrying, state.hasSucceeded]);
  
  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);
  
  if (!showUI || (!state.lastError && !state.isRetrying && !state.hasSucceeded)) {
    return null;
  }
  
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const errorCategory = state.lastError ? getErrorCategory(state.lastError) : 'unknown';
  const userMessage = state.lastError ? getUserFriendlyErrorMessage(state.lastError) : '';
  const canRetry = state.currentAttempt < fullConfig.maxAttempts;
  const isWaitingToRetry = state.nextRetryIn > 0;
  
  // Compact view for inline usage
  if (compact) {
    if (state.hasSucceeded) {
      return (
        <Alert severity="success" variant="outlined" sx={{ my: 1 }}>
          Operation completed successfully
        </Alert>
      );
    }
    
    if (state.isRetrying) {
      return (
        <Alert severity="info" variant="outlined" sx={{ my: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="body2">Retrying...</Typography>
            <LinearProgress sx={{ flex: 1, maxWidth: 100 }} />
          </Stack>
        </Alert>
      );
    }
    
    if (state.lastError) {
      return (
        <Alert 
          severity="error" 
          variant="outlined" 
          sx={{ my: 1 }}
          action={
            <Stack direction="row" spacing={1}>
              {isWaitingToRetry && (
                <Chip 
                  label={`Retry in ${formatTimeRemaining(state.nextRetryIn)}`}
                  size="small"
                  icon={<ScheduleIcon />}
                />
              )}
              {canRetry && !isWaitingToRetry && (
                <Button size="small" onClick={retry} startIcon={<RetryIcon />}>
                  Retry
                </Button>
              )}
            </Stack>
          }
        >
          {userMessage}
        </Alert>
      );
    }
    
    return null;
  }
  
  // Full UI view
  return (
    <RetryContainer>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" alignItems="flex-start" spacing={2}>
            <Box sx={{ color: state.hasSucceeded ? 'success.main' : 'error.main' }}>
              {state.hasSucceeded ? <SuccessIcon /> : <ErrorIcon />}
            </Box>
            
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
                {state.hasSucceeded ? 'Operation Successful' : title}
              </Typography>
              
              {description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {description}
                </Typography>
              )}
              
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip 
                  label={`Attempt ${state.currentAttempt}/${fullConfig.maxAttempts}`}
                  size="small"
                  variant="outlined"
                />
                {state.lastError && (
                  <Chip 
                    label={errorCategory.toUpperCase()}
                    size="small"
                    color={errorCategory === 'network' ? 'warning' : 'error'}
                    variant="outlined"
                  />
                )}
              </Stack>
            </Box>
            
            {state.lastError && (
              <IconButton
                size="small"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Stack>
          
          {/* Error Message */}
          {state.lastError && (
            <Typography variant="body1" color="text.primary">
              {userMessage}
            </Typography>
          )}
          
          {/* Progress Bar for Active Retry */}
          {state.isRetrying && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Retrying operation...
              </Typography>
              <RetryProgress />
            </Box>
          )}
          
          {/* Countdown for Next Retry */}
          {isWaitingToRetry && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Next retry in {formatTimeRemaining(state.nextRetryIn)}
              </Typography>
              <RetryProgress 
                variant="determinate" 
                value={((calculateDelay(state.currentAttempt, fullConfig) / 1000) - state.nextRetryIn) / (calculateDelay(state.currentAttempt, fullConfig) / 1000) * 100}
              />
            </Box>
          )}
          
          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            {canRetry && !state.isRetrying && !isWaitingToRetry && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={retry}
                startIcon={<RetryIcon />}
                sx={{ textTransform: 'none' }}
              >
                Retry Now
              </Button>
            )}
            
            {(state.isRetrying || isWaitingToRetry) && (
              <Button
                variant="outlined"
                size="small"
                onClick={cancel}
                startIcon={<CancelIcon />}
                sx={{ textTransform: 'none' }}
              >
                Cancel
              </Button>
            )}
            
            {!canRetry && !state.hasSucceeded && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => window.location.reload()}
                sx={{ textTransform: 'none' }}
              >
                Refresh Page
              </Button>
            )}
          </Stack>
          
          {/* Error Details */}
          {state.lastError && (
            <Collapse in={showDetails}>
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                bgcolor: 'grey.50', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Technical Details:
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Error:</strong> {state.lastError.name}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Message:</strong> {state.lastError.message}
                </Typography>
                {state.lastError.stack && (
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
                      {state.lastError.stack}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          )}
        </Stack>
      </CardContent>
    </RetryContainer>
  );
};

export default RetryHandler;