import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Check,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';
import { 
  Box, 
  Paper, 
  Typography, 
  IconButton, 
  Button, 
  Badge,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Fade,
  Tooltip,
  Alert
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

interface NotificationCenterProps {
  onNotificationCountChange?: (count: number) => void;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

// Keyframes for animations
const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
    color: white;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
    color: #fbbf24;
  }
`;

// Styled components matching the site's design system
const NotificationDropdown = styled(Paper)(({ theme }) => ({
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 420,
  maxHeight: 'calc(100vh - 100px)',
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)', // For Safari
  borderRadius: 16,
  boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.2)',
  border: `1px solid ${theme.palette.divider}`,
  zIndex: 1400, // Ensure it's above other elements
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.down('sm')]: {
    width: '95vw',
    maxHeight: '80vh',
    right: '2.5vw',
  },
}));

const NotificationHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  flexShrink: 0,
}));

const NotificationContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  overflowY: 'auto',
  padding: theme.spacing(0, 1),
  '&::-webkit-scrollbar': {
    width: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: theme.palette.background.default,
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[300],
    borderRadius: 4,
    border: `1px solid ${theme.palette.background.default}`,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: theme.palette.grey[400],
  },
}));

const NotificationItemActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  position: 'absolute',
  top: '50%',
  right: '16px',
  transform: 'translateY(-50%)',
  opacity: 0,
  transition: 'opacity 0.2s ease-in-out',
  '&.notification-item-actions': {},
});

const NotificationItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUnread',
})<{ isUnread?: boolean }>(({ theme, isUnread }) => ({
  padding: theme.spacing(1.5, 2),
  margin: theme.spacing(1),
  borderRadius: 12,
  border: `1px solid transparent`,
  backgroundColor: isUnread ? theme.palette.primary.main + '15' : 'transparent',
  transition: 'all 0.2s ease',
  position: 'relative',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.divider,
    '& .notification-item-actions': {
      opacity: 1,
    }
  },
}));

const NotificationActions = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: theme.palette.background.default,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: 'space-between',
  alignItems: 'center',
  flexShrink: 0,
}));

const BellButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isPulsing',
})<{ isPulsing?: boolean }>(({ theme, isPulsing }) => ({
  padding: theme.spacing(1.5),
  color: 'white',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: theme.palette.grey[200],
  },
  animation: isPulsing ? `${pulse} 1.5s infinite` : 'none',
  '& svg': {
    animation: isPulsing ? `${pulse} 1.5s infinite` : 'none',
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 12,
    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
  },
}));

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  const theme = useTheme();

  const getAlertSeverity = () => {
    switch (type) {
      case 'danger': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'warning';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'danger': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'primary';
      default: return 'warning';
    }
  };

  return (
    <StyledDialog open={isOpen} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Alert severity={getAlertSeverity()} sx={{ mb: 2 }}>
          <Typography variant="body2">
            {message}
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button 
          onClick={onCancel}
          variant="outlined"
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained"
          color={getButtonColor()}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onNotificationCountChange
}) => {
  const theme = useTheme();
  useMediaQuery(theme.breakpoints.down('md')); // Used for responsive design
  const [isOpen, setIsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Update parent component about count changes
  useEffect(() => {
    onNotificationCountChange?.(unreadCount);
  }, [unreadCount, onNotificationCountChange]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Get icon for notification type with theme colors
  const getNotificationIcon = (type: string) => {
    const iconProps = { size: 16 };
    
    switch (type) {
      case 'success':
        return <CheckCircle {...iconProps} style={{ color: theme.palette.success.main }} />;
      case 'error':
        return <AlertCircle {...iconProps} style={{ color: theme.palette.error.main }} />;
      case 'warning':
        return <AlertTriangle {...iconProps} style={{ color: theme.palette.warning.main }} />;
      case 'info':
      default:
        return <Info {...iconProps} style={{ color: theme.palette.primary.main }} />;
    }
  };

  // Handle dismiss all notifications with proper confirmation
  const handleDismissAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All Notifications',
      message: 'Are you sure you want to clear all notifications? This action cannot be undone.',
      type: 'warning',
      onConfirm: () => {
        clearAll();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle individual notification deletion
  const handleDeleteNotification = (id: string, message: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Notification',
      message: `Are you sure you want to delete this notification?\n\n"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
      type: 'danger',
      onConfirm: () => {
        deleteNotification(id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Format timestamp helper
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      if (!isValid(date)) {
        return 'Invalid date';
      }
      
      const now = new Date();
      const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return formatDistanceToNow(date, { addSuffix: true });
      }
      
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  // Debounced refresh function
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await fetchNotifications();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  return (
    <>
      <Box position="relative" ref={dropdownRef}>
        {/* Notification Bell Button */}
        <Tooltip title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}>
          <BellButton
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            isPulsing={unreadCount > 0}
          >
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <Bell size={24} />
            </Badge>
          </BellButton>
        </Tooltip>

        {/* Notification Dropdown */}
        <Fade in={isOpen}>
          <NotificationDropdown>
            {/* Header */}
            <NotificationHeader>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Notifications
                {unreadCount > 0 && (
                  <Typography 
                    component="span" 
                    variant="body2" 
                    sx={{ 
                      ml: 1, 
                      color: 'text.secondary',
                      fontWeight: 400 
                    }}
                  >
                    ({unreadCount} unread)
                  </Typography>
                )}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Tooltip title="Refresh">
                  <IconButton 
                    size="small" 
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                  >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton 
                    size="small" 
                    onClick={() => setIsOpen(false)}
                  >
                    <X size={16} />
                  </IconButton>
                </Tooltip>
              </Box>
            </NotificationHeader>

            {/* Content */}
            <NotificationContent>
              {loading && (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {error && (
                <Box p={3}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2">
                      Failed to load notifications: {error}
                    </Typography>
                  </Alert>
                </Box>
              )}

              {!loading && !error && notifications.length === 0 && (
                <Box p={4} textAlign="center" sx={{ color: 'text.secondary' }}>
                   <Bell size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                    All caught up!
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    You don't have any notifications yet.
                  </Typography>
                </Box>
              )}

              {!loading && !error && notifications.map((notification) => (
                <NotificationItem key={notification.id} isUnread={!notification.read}>
                  <Box display="flex" alignItems="flex-start" gap={2}>
                    <Box mt={0.5}>
                      {getNotificationIcon(notification.type)}
                    </Box>
                    
                    <Box flex={1} minWidth={0}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: notification.read ? 400 : 600,
                          color: 'text.primary',
                          mb: 0.5,
                          wordBreak: 'break-word'
                        }}
                      >
                        {notification.message}
                      </Typography>
                      
                      <Typography variant="caption" color="text.secondary">
                        {formatTimestamp(notification.createdAt)}
                        {notification.category && (
                          <>
                            <Box component="span" sx={{ mx: 0.5 }}>•</Box>
                            {notification.category}
                          </>
                        )}
                      </Typography>
                    </Box>
                  </Box>

                  <NotificationItemActions className="notification-item-actions">
                      {/* Actions appear on hover */}
                      {!notification.read && (
                        <Tooltip title="Mark as read">
                          <IconButton
                            size="small"
                            onClick={() => markAsRead(notification.id)}
                            sx={{ 
                              color: 'text.secondary',
                              '&:hover': { color: 'success.main', backgroundColor: 'success.light' + '25' } 
                            }}
                          >
                            <Check size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteNotification(notification.id, notification.message)}
                           sx={{ 
                             color: 'text.secondary',
                             '&:hover': { color: 'error.main', backgroundColor: 'error.light' + '25' } 
                           }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Tooltip>
                  </NotificationItemActions>
                </NotificationItem>
              ))}
            </NotificationContent>

            {/* Actions */}
            {notifications.length > 0 && (
              <NotificationActions>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    fontSize: '0.75rem',
                  }}
                >
                  Mark all read
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleDismissAll}
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    fontSize: '0.75rem',
                  }}
                >
                  Clear all
                </Button>
              </NotificationActions>
            )}
          </NotificationDropdown>
        </Fade>
      </Box>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        type={confirmDialog.type}
      />
    </>
  );
}; 