import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Chip,
  Alert,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNotifications } from '../../hooks/useNotifications';

interface SessionExtensionPromptProps {
  expiresInMinutes: number;
  gracePeriodMinutes?: number;
  onExtend: () => Promise<boolean>;
  onDismiss: () => void;
  onLogout: () => void;
}

interface SessionExtensionPromptState {
  isVisible: boolean;
  expiresInMinutes: number;
  gracePeriodMinutes: number;
  countdown: number;
  isExtending: boolean;
  extensionSuccess: boolean | null;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    minWidth: 400,
    maxWidth: 500,
    width: '95vw',
    maxHeight: '90vh',
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1),
      width: `calc(100vw - ${theme.spacing(2)})`,
      maxWidth: 'none',
      borderRadius: 16,
      minWidth: 'auto',
      maxHeight: '95vh',
    },
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  position: 'relative',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}10 100%)`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5),
    paddingBottom: theme.spacing(1.5),
  },
}));

const HeaderIcon = styled(Box)<{ $color: string; $bgColor: string }>(({ theme, $color, $bgColor }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 64,
  height: 64,
  borderRadius: 20,
  backgroundColor: $bgColor,
  color: $color,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  fontSize: '2rem',
  [theme.breakpoints.down('sm')]: {
    width: 56,
    height: 56,
    fontSize: '1.75rem',
  },
}));

const CountdownChip = styled(Chip)(({ theme }) => ({
  fontSize: '0.875rem',
  height: 32,
  fontWeight: 600,
  '&.critical': {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    animation: 'pulse 1s infinite',
  },
  '&.warning': {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  },
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.7,
    },
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1.5, 3),
  minWidth: 120,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.25, 2.5),
    minWidth: 100,
  },
}));

const SessionExtensionPrompt: React.FC<SessionExtensionPromptProps> = ({
  expiresInMinutes,
  gracePeriodMinutes = 2,
  onExtend,
  onDismiss,
  onLogout
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [state, setState] = useState<SessionExtensionPromptState>({
    isVisible: true,
    expiresInMinutes,
    gracePeriodMinutes,
    countdown: gracePeriodMinutes * 60, // Convert to seconds
    isExtending: false,
    extensionSuccess: null
  });

  const { addNotification } = useNotifications();

  // Countdown timer for grace period
  useEffect(() => {
    if (state.countdown <= 0) {
      // Grace period expired, logout user
      addNotification('Session expired. Logging you out.', 'error', {
        persistent: true,
        category: 'Authentication'
      });
      onLogout();
      return;
    }

    const timer = setInterval(() => {
      setState(prev => ({
        ...prev,
        countdown: prev.countdown - 1
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [state.countdown, onLogout, addNotification]);

  // Update countdown display
  useEffect(() => {
    const minutes = Math.floor(state.countdown / 60);
    const seconds = state.countdown % 60;
    
    // Update document title to show countdown
    if (state.countdown <= 60) { // Only show in last minute
      document.title = `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')} - ShopGauge`;
    } else {
      document.title = 'ShopGauge';
    }
  }, [state.countdown]);

  const handleExtend = useCallback(async () => {
    setState(prev => ({ ...prev, isExtending: true }));
    
    try {
      const success = await onExtend();
      
      if (success) {
        setState(prev => ({ 
          ...prev, 
          isExtending: false, 
          extensionSuccess: true,
          isVisible: false 
        }));
        
        addNotification('Session extended successfully!', 'success', {
          duration: 5000,
          category: 'Authentication'
        });
        
        // Reset document title
        document.title = 'ShopGauge';
        
        // Hide the prompt after success
        setTimeout(() => {
          onDismiss();
        }, 1000);
      } else {
        setState(prev => ({ 
          ...prev, 
          isExtending: false, 
          extensionSuccess: false 
        }));
        
        addNotification('Failed to extend session. Please try again.', 'error', {
          duration: 5000,
          category: 'Authentication'
        });
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isExtending: false, 
        extensionSuccess: false 
      }));
      
      addNotification('Network error while extending session.', 'error', {
        duration: 5000,
        category: 'Authentication'
      });
    }
  }, [onExtend, onDismiss, addNotification]);

  const handleDismiss = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    onDismiss();
  }, [onDismiss]);

  const handleLogout = useCallback(() => {
    addNotification('Logging out due to session expiration.', 'warning', {
      duration: 3000,
      category: 'Authentication'
    });
    onLogout();
  }, [onLogout, addNotification]);

  // Format countdown display
  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine if session is in grace period
  const isInGracePeriod = state.expiresInMinutes <= 0;
  const isCritical = state.countdown <= 30; // Last 30 seconds

  // Get theme colors based on state
  const getThemeColors = () => {
    if (isCritical) {
      return {
        primary: theme.palette.error.main,
        secondary: theme.palette.error.light,
        background: theme.palette.error.light + '15',
        text: theme.palette.error.dark,
        icon: ErrorIcon,
      };
    } else if (isInGracePeriod) {
      return {
        primary: theme.palette.warning.main,
        secondary: theme.palette.warning.light,
        background: theme.palette.warning.light + '15',
        text: theme.palette.warning.dark,
        icon: WarningIcon,
      };
    } else {
      return {
        primary: theme.palette.info.main,
        secondary: theme.palette.info.light,
        background: theme.palette.info.light + '15',
        text: theme.palette.info.dark,
        icon: TimerIcon,
      };
    }
  };

  const colors = getThemeColors();
  const IconComponent = colors.icon;

  if (!state.isVisible) {
    return null;
  }

  return (
    <StyledDialog
      open={state.isVisible}
      onClose={handleDismiss}
      TransitionComponent={Slide}
      transitionDuration={300}
      maxWidth="sm"
      fullWidth
    >
      <StyledDialogTitle>
        <IconButton
          onClick={handleDismiss}
          disabled={state.isExtending}
          sx={{
            position: 'absolute',
            right: theme.spacing(2),
            top: theme.spacing(2),
            color: theme.palette.text.secondary,
            '&:hover': {
              color: theme.palette.text.primary,
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        <HeaderIcon $color={colors.primary} $bgColor={colors.background}>
          <IconComponent />
        </HeaderIcon>

        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: colors.text }}>
          {isCritical 
            ? 'Session Expiring Soon!' 
            : isInGracePeriod 
              ? 'Session Expired' 
              : 'Session Extension Required'
          }
        </Typography>
      </StyledDialogTitle>

      <DialogContent sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ mb: 2, color: theme.palette.text.secondary }}>
          {isCritical 
            ? `Your session will expire in ${formatCountdown(state.countdown)}. Extend now to continue working.`
            : isInGracePeriod 
              ? `Your session has expired. You will be logged out in ${formatCountdown(state.countdown)} unless you extend your session.`
              : `Your session will expire in ${state.expiresInMinutes} minutes. Would you like to extend it?`
          }
        </Typography>

        {/* Countdown display */}
        {isInGracePeriod && (
          <Box sx={{ mb: 3 }}>
            <CountdownChip
              label={`${formatCountdown(state.countdown)} remaining`}
              className={isCritical ? 'critical' : 'warning'}
              icon={<TimerIcon />}
            />
          </Box>
        )}

        {/* Success/Error message */}
        {state.extensionSuccess !== null && (
          <Alert
            severity={state.extensionSuccess ? 'success' : 'error'}
            sx={{ mb: 2 }}
            icon={state.extensionSuccess ? <CheckCircleIcon /> : <ErrorIcon />}
          >
            {state.extensionSuccess 
              ? 'Session extended successfully!' 
              : 'Failed to extend session. Please try again.'
            }
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, gap: 2, justifyContent: 'center' }}>
        {isInGracePeriod && (
          <ActionButton
            variant="outlined"
            onClick={handleLogout}
            disabled={state.isExtending}
            startIcon={<LogoutIcon />}
            sx={{
              borderColor: theme.palette.grey[400],
              color: theme.palette.text.secondary,
              '&:hover': {
                borderColor: theme.palette.grey[600],
                color: theme.palette.text.primary,
              },
            }}
          >
            Logout Now
          </ActionButton>
        )}

        {!isInGracePeriod && (
          <ActionButton
            variant="outlined"
            onClick={handleDismiss}
            disabled={state.isExtending}
            sx={{
              borderColor: theme.palette.grey[400],
              color: theme.palette.text.secondary,
              '&:hover': {
                borderColor: theme.palette.grey[600],
                color: theme.palette.text.primary,
              },
            }}
          >
            Dismiss
          </ActionButton>
        )}

        <ActionButton
          variant="contained"
          onClick={handleExtend}
          disabled={state.isExtending}
          startIcon={state.isExtending ? <CircularProgress size={16} /> : <RefreshIcon />}
          sx={{
            backgroundColor: colors.primary,
            '&:hover': {
              backgroundColor: colors.secondary,
            },
            '&:disabled': {
              backgroundColor: theme.palette.action.disabled,
            },
          }}
        >
          {state.isExtending ? 'Extending...' : 'Extend Session'}
        </ActionButton>
      </DialogActions>
    </StyledDialog>
  );
};

export default SessionExtensionPrompt; 