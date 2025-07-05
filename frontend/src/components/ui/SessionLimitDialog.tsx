import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Skeleton,
  Alert,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  Computer as ComputerIcon,
  Phone as PhoneIcon,
  Tablet as TabletIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { getDeviceDisplay, getRelativeTime, isCurrentDevice, getLocationFromIP } from '../../utils/deviceUtils';

interface SessionInfo {
  sessionId: string;
  isCurrentSession: boolean;
  createdAt: string;
  lastAccessedAt: string;
  lastUsedFormatted?: string;
  ipAddress: string;
  userAgent: string;
  isExpired: boolean;
  expiresAt?: string;
}

interface SessionLimitDialogProps {
  open: boolean;
  onClose: () => void;
  onSessionDeleted: (sessionId: string) => void;
  onSessionsDeleted?: (sessionIds: string[]) => Promise<{ success: number; failed: number }>;
  onContinue: () => void;
  sessions: SessionInfo[];
  loading?: boolean;
  maxSessions?: number;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    minWidth: 500,
    maxWidth: 600,
    width: '90vw',
    maxHeight: '85vh',
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(2),
      width: `calc(100vw - ${theme.spacing(4)})`,
      maxWidth: 'none',
      borderRadius: 16,
    },
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingBottom: theme.spacing(2),
  position: 'relative',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}10 100%)`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5),
    paddingBottom: theme.spacing(1.5),
  },
}));

const SessionCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    borderColor: theme.palette.primary.light,
    boxShadow: theme.shadows[4],
  },
  '&.current-session': {
    borderColor: theme.palette.success.main,
    backgroundColor: `${theme.palette.success.main}08`,
  },
  '&.selected-for-deletion': {
    borderColor: theme.palette.error.main,
    backgroundColor: `${theme.palette.error.main}08`,
  },
}));

const DeviceIcon = styled(Box)(({ theme }) => ({
  fontSize: '2rem',
  marginRight: theme.spacing(1.5),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: theme.palette.action.hover,
  [theme.breakpoints.down('sm')]: {
    width: 40,
    height: 40,
    fontSize: '1.5rem',
    marginRight: theme.spacing(1),
  },
}));

const SessionDetails = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  flexWrap: 'wrap',
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  fontSize: '0.75rem',
  height: 24,
  '&.current': {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  },
  '&.active': {
    backgroundColor: theme.palette.info.main,
    color: theme.palette.info.contrastText,
  },
}));

const HeaderIcon = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 56,
  height: 56,
  borderRadius: 16,
  backgroundColor: `${theme.palette.warning.main}20`,
  color: theme.palette.warning.main,
  marginBottom: theme.spacing(2),
  fontSize: '1.75rem',
}));

export const SessionLimitDialog: React.FC<SessionLimitDialogProps> = ({
  open,
  onClose,
  onSessionDeleted,
  onSessionsDeleted,
  onContinue,
  sessions,
  loading = false,
  maxSessions = 5,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedSessions(new Set());
      setDeleting(new Set());
    }
  }, [open]);

  const handleSessionToggle = (sessionId: string, isCurrentSession: boolean) => {
    if (isCurrentSession) return; // Can't delete current session

    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.size === 0) return;

    setDeleting(new Set(selectedSessions));

    try {
      if (onSessionsDeleted && selectedSessions.size > 1) {
        // Use bulk delete for multiple sessions (sends one notification)
        const sessionIds = Array.from(selectedSessions);
        const result = await onSessionsDeleted(sessionIds);
        
        // Check if we have enough space now
        if (result.success > 0) {
          const remainingSessions = sessions.filter(s => !selectedSessions.has(s.sessionId));
          if (remainingSessions.length < maxSessions) {
            onContinue();
          }
        }
      } else {
        // Fallback to individual deletion for single session or when bulk delete not available
        for (const sessionId of selectedSessions) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between requests
          onSessionDeleted(sessionId);
        }

        // Check if we have enough space now
        const remainingSessions = sessions.filter(s => !selectedSessions.has(s.sessionId));
        if (remainingSessions.length < maxSessions) {
          onContinue();
        }
      }
    } catch (error) {
      console.error('Error deleting sessions:', error);
    } finally {
      setDeleting(new Set());
      setSelectedSessions(new Set());
    }
  };

  const renderSessionItem = (session: SessionInfo) => {
    const device = getDeviceDisplay(session.userAgent);
    const isSelected = selectedSessions.has(session.sessionId);
    const isDeleting = deleting.has(session.sessionId);
    const isCurrent = session.isCurrentSession;
    const relativeTime = session.lastUsedFormatted || getRelativeTime(session.lastAccessedAt);
    const location = getLocationFromIP(session.ipAddress);

    const getDeviceIcon = () => {
      if (device.icon === '📱') {
        return device.name.includes('iPad') || device.name.includes('Tablet') ? 
          <TabletIcon /> : <PhoneIcon />;
      }
      return <ComputerIcon />;
    };

    const cardClass = isCurrent ? 'current-session' : isSelected ? 'selected-for-deletion' : '';

    return (
      <Fade in timeout={300} key={session.sessionId}>
        <SessionCard className={cardClass}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box display="flex" alignItems="flex-start">
              <DeviceIcon>
                {getDeviceIcon()}
              </DeviceIcon>

              <Box flex={1} minWidth={0}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="h6" fontWeight={600} noWrap>
                    {device.name}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    {isCurrent && (
                      <StatusChip 
                        label="Current" 
                        size="small" 
                        className="current"
                        icon={<CheckCircleIcon sx={{ fontSize: '0.875rem !important' }} />}
                      />
                    )}
                    
                    {!isCurrent && (
                      <Button
                        size="small"
                        variant={isSelected ? "contained" : "outlined"}
                        color={isSelected ? "error" : "primary"}
                        onClick={() => handleSessionToggle(session.sessionId, isCurrent)}
                        disabled={isDeleting}
                        sx={{ minWidth: 80 }}
                      >
                        {isDeleting ? (
                          <Box sx={{ width: 16, height: 16 }}>
                            <LinearProgress color="inherit" />
                          </Box>
                        ) : isSelected ? (
                          'Selected'
                        ) : (
                          'Select'
                        )}
                      </Button>
                    )}
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {device.subtitle}
                </Typography>

                <SessionDetails>
                  <Chip
                    icon={<AccessTimeIcon sx={{ fontSize: '0.875rem !important' }} />}
                    label={relativeTime}
                    size="small"
                    variant="outlined"
                  />
                  
                  {location !== 'Unknown Location' && (
                    <Chip
                      icon={<LocationIcon sx={{ fontSize: '0.875rem !important' }} />}
                      label={location}
                      size="small"
                      variant="outlined"
                    />
                  )}

                  {session.ipAddress && !session.ipAddress.startsWith('192.168.') && (
                    <Typography variant="caption" color="text.secondary">
                      IP: {session.ipAddress}
                    </Typography>
                  )}
                </SessionDetails>
              </Box>
            </Box>
          </CardContent>
        </SessionCard>
      </Fade>
    );
  };

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      TransitionComponent={Slide}
      TransitionProps={{ direction: 'up' } as any}
    >
      <StyledDialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <HeaderIcon>
              <WarningIcon />
            </HeaderIcon>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Session Limit Reached
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can only have {maxSessions} active sessions. Please remove some sessions to continue.
            </Typography>
          </Box>
          
          <IconButton 
            onClick={onClose}
            sx={{ 
              position: 'absolute',
              right: 16,
              top: 16,
              [theme.breakpoints.down('sm')]: {
                right: 12,
                top: 12,
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </StyledDialogTitle>

      <DialogContent sx={{ p: 3, pt: 2 }}>
        <Alert 
          severity="info" 
          sx={{ mb: 3, borderRadius: 2 }}
          icon={<WarningIcon />}
        >
          <Typography variant="body2">
            <strong>Active Sessions: {sessions.length}/{maxSessions}</strong>
            <br />
            Select sessions to remove. You cannot remove your current session.
          </Typography>
        </Alert>

        {loading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Card key={i} sx={{ mb: 1.5, borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box display="flex" alignItems="center">
                    <Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: 1.5, mr: 2 }} />
                    <Box flex={1}>
                      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
                      <Box display="flex" gap={1}>
                        <Skeleton variant="rounded" width={80} height={24} />
                        <Skeleton variant="rounded" width={100} height={24} />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Box>
            {sessions.map(renderSessionItem)}
          </Box>
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          size="large"
        >
          Cancel
        </Button>
        
        <Box display="flex" gap={2}>
          {selectedSessions.size > 0 && (
            <Button
              onClick={handleDeleteSelected}
              variant="contained"
              color="error"
              size="large"
              disabled={deleting.size > 0}
              startIcon={deleting.size > 0 ? null : <DeleteIcon />}
            >
              {deleting.size > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress sx={{ width: 40, height: 4 }} />
                  Removing...
                </Box>
              ) : (
                `Remove ${selectedSessions.size} Session${selectedSessions.size !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
          
          <Button
            onClick={onContinue}
            variant="contained"
            size="large"
            disabled={sessions.length >= maxSessions}
          >
            Continue
          </Button>
        </Box>
      </DialogActions>
    </StyledDialog>
  );
};

export default SessionLimitDialog; 