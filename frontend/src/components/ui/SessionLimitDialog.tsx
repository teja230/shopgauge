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
  Skeleton,
  Alert,
  Fade,
  Slide,
  useTheme,
  useMediaQuery,
  Divider,
  LinearProgress,
  Avatar,
  Stack,
} from '@mui/material';
import {
  X as CloseIcon,
  Trash2 as DeleteIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertTriangle as WarningIcon,
  Clock as AccessTimeIcon,
  MapPin as LocationIcon,
  ShieldCheck as SecurityIcon,
  Users as PeopleIcon,
  Info as InfoIcon,
  RefreshCw as RefreshIcon,
} from 'lucide-react';
import { styled } from '@mui/material/styles';
import { getDeviceDisplay, getRelativeTime, getLocationFromIP } from '../../utils/deviceUtils';

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
  limitReached?: boolean;
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    minWidth: 480,
    maxWidth: 640,
    width: '90vw',
    maxHeight: '85vh',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      minWidth: 400,
      maxWidth: 560,
      width: '92vw',
    },
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1),
      width: `calc(100vw - ${theme.spacing(2)})`,
      maxWidth: 'none',
      borderRadius: 12,
      minWidth: 'auto',
      maxHeight: '90vh',
    },
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(3, 3, 2, 3),
  position: 'relative',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.secondary.main}05 100%)`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2.5, 2.5, 1.5, 2.5),
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3, 3, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.default,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5, 2, 2, 2),
  },
}));

const HeaderIcon = styled(Box)<{ $color: string; $bgColor: string }>(({ theme, $color, $bgColor }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: $bgColor,
  color: $color,
  marginRight: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    width: 40,
    height: 40,
    marginRight: theme.spacing(1.5),
  },
}));

const SessionCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-1px)',
  },
  '&.current-session': {
    border: `2px solid ${theme.palette.success.main}`,
    backgroundColor: `${theme.palette.success.main}08`,
    boxShadow: `0 0 0 1px ${theme.palette.success.main}20`,
  },
  '&.selected-for-deletion': {
    border: `2px solid ${theme.palette.error.main}`,
    backgroundColor: `${theme.palette.error.main}08`,
    boxShadow: `0 0 0 1px ${theme.palette.error.main}20`,
  },
  [theme.breakpoints.down('sm')]: {
    marginBottom: theme.spacing(1.5),
    borderRadius: 10,
  },
}));

const DeviceAvatar = styled(Avatar)(({ theme }) => ({
  width: 48,
  height: 48,
  fontSize: '1.5rem',
  borderRadius: 12,
  [theme.breakpoints.down('sm')]: {
    width: 40,
    height: 40,
    fontSize: '1.25rem',
  },
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  fontWeight: 600,
  '&.current': {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
    '& .MuiChip-icon': {
      color: theme.palette.success.contrastText,
    },
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1, 2.5),
  minHeight: 40,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0.75, 2),
    minHeight: 36,
  },
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
  limitReached = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const currentSessionCount = sessions.length;
  const isLimitReached = limitReached || currentSessionCount >= maxSessions;

  const handleSessionToggle = (sessionId: string, isCurrentSession: boolean) => {
    if (isCurrentSession) return;
    
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedSessions.size === 0 || !onSessionsDeleted) return;
    
    setIsDeleting(true);
    try {
      const sessionIds = Array.from(selectedSessions);
      const result = await onSessionsDeleted(sessionIds);
      
      if (result.success > 0) {
        setSelectedSessions(new Set());
      }
    } catch (error) {
      console.error('Failed to delete sessions:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setSelectedSessions(new Set());
    setDeleting(new Set());
    onClose();
  };

  const getDialogTitle = () => {
    if (isLimitReached) {
      return "Session Limit Reached";
    } else {
      return "Manage Active Sessions";
    }
  };

  const getDialogDescription = () => {
    if (isLimitReached) {
      return `You can only have ${maxSessions} active sessions. Please remove some sessions to continue.`;
    } else {
      return `You have ${currentSessionCount} active sessions (${Math.max(0, maxSessions - currentSessionCount)} slots remaining). You can manage them here.`;
    }
  };

  const getHeaderIcon = () => {
    if (isLimitReached) {
      return <WarningIcon />;
    } else {
      return <PeopleIcon />;
    }
  };

  const getHeaderIconColor = () => {
    if (isLimitReached) {
      return theme.palette.warning.main;
    } else {
      return theme.palette.info.main;
    }
  };

  const getHeaderIconBg = () => {
    if (isLimitReached) {
      return `${theme.palette.warning.main}15`;
    } else {
      return `${theme.palette.info.main}15`;
    }
  };

  const renderSessionItem = (session: SessionInfo) => {
    const device = getDeviceDisplay(session.userAgent);
    const isSelected = selectedSessions.has(session.sessionId);
    const isDeleting = deleting.has(session.sessionId);
    const isCurrent = session.isCurrentSession;
    const relativeTime = session.lastUsedFormatted || getRelativeTime(session.lastAccessedAt);
    const location = getLocationFromIP(session.ipAddress);

    const cardClass = isCurrent ? 'current-session' : isSelected ? 'selected-for-deletion' : '';

    return (
      <Fade in timeout={300} key={session.sessionId}>
        <SessionCard className={cardClass}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box display="flex" alignItems="flex-start">
              <DeviceAvatar sx={{ 
                bgcolor: 'grey.100', 
                color: 'text.primary',
                mr: 2,
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {device.icon}
              </DeviceAvatar>

              <Box flex={1} minWidth={0}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Box>
                    <Typography variant="h6" fontWeight={600} noWrap>
                      {device.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {device.subtitle}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    {isCurrent && (
                      <StatusChip 
                        label="Current" 
                        size="small" 
                        className="current"
                        icon={<CheckCircleIcon size={14} />}
                      />
                    )}
                    
                    {!isCurrent && (
                      <ActionButton
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
                      </ActionButton>
                    )}
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                  <Chip
                    icon={<AccessTimeIcon size={14} />}
                    label={relativeTime}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                  
                  {location !== 'Unknown Location' && (
                    <Chip
                      icon={<LocationIcon size={14} />}
                      label={location}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  )}

                  {session.ipAddress && !session.ipAddress.startsWith('192.168.') && (
                    <Chip
                      icon={<SecurityIcon size={14} />}
                      label={`IP: ${session.ipAddress}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  )}
                </Stack>
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
      onClose={handleClose}
      TransitionComponent={Slide}
      transitionDuration={300}
      fullWidth
      maxWidth="md"
    >
      <StyledDialogTitle>
        <Box display="flex" alignItems="center">
          <HeaderIcon $color={getHeaderIconColor()} $bgColor={getHeaderIconBg()}>
            {getHeaderIcon()}
          </HeaderIcon>
          <Box flex={1}>
            <Typography variant="h5" fontWeight={700} gutterBottom={false}>
              {getDialogTitle()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {getDialogDescription()}
            </Typography>
          </Box>
          <IconButton
            onClick={handleClose}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </StyledDialogTitle>

      <StyledDialogContent>
        {loading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
              </Box>
            ))}
          </Box>
        ) : sessions.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No active sessions found.
          </Alert>
        ) : (
          <Box>
            {sessions.map(renderSessionItem)}
          </Box>
        )}

        {selectedSessions.size > 0 && (
          <Alert 
            severity="warning" 
            sx={{ 
              mt: 2, 
              borderRadius: 2,
            }}
          >
            <Typography variant="body2">
              {selectedSessions.size} session{selectedSessions.size !== 1 ? 's' : ''} selected for deletion
            </Typography>
          </Alert>
        )}
      </StyledDialogContent>

      <StyledDialogActions>
        <Box display="flex" justifyContent="space-between" width="100%">
          <Box>
            <ActionButton
              variant="outlined"
              onClick={handleClose}
            >
              Close
            </ActionButton>
          </Box>
          
          <Box display="flex" gap={1}>
            {selectedSessions.size > 0 && (
              <ActionButton
                variant="contained"
                color="error"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                startIcon={<DeleteIcon />}
              >
                {isDeleting ? 'Deleting...' : 'Delete Selected'}
              </ActionButton>
            )}
            
            {isLimitReached && selectedSessions.size === 0 && (
              <ActionButton
                variant="contained"
                color="primary"
                onClick={onContinue}
              >
                Continue
              </ActionButton>
            )}
          </Box>
        </Box>
      </StyledDialogActions>
    </StyledDialog>
  );
};

export default SessionLimitDialog; 