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
  top: '100%',
  right: 0,
  width: '380px',
  maxHeight: '500px',
  marginTop: theme.spacing(1),
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: 16,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  zIndex: 1300, // Below confirmation dialogs
  overflow: 'hidden',
  [theme.breakpoints.down('sm')]: {
    width: '320px',
    right: '-20px',
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
  zIndex: 1400, // Above notification center (1300)
  '& .MuiDialog-paper': {
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
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

  const getIconByType = () => {
    switch (type) {
      case 'danger': return <AlertCircle size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      case 'info': return <Info size={20} />;
      default: return <AlertTriangle size={20} />;
    }
  };

  return (
    <StyledDialog open={isOpen} onClose={onCancel} maxWidth="sm" fullWidth>
      <Box sx={{ p: 3 }}>
        {/* Header with icon */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '12px',
              backgroundColor: `${type === 'danger' ? theme.palette.error.main : 
                              type === 'warning' ? theme.palette.warning.main :
                              theme.palette.primary.main}20`,
              color: type === 'danger' ? theme.palette.error.main : 
                     type === 'warning' ? theme.palette.warning.main :
                     theme.palette.primary.main,
            }}
          >
            {getIconByType()}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', flex: 1 }}>
          {title}
        </Typography>
        </Box>

        {/* Message with enhanced styling */}
        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            backgroundColor: `${type === 'danger' ? theme.palette.error.main : 
                            type === 'warning' ? theme.palette.warning.main :
                            theme.palette.primary.main}08`,
            border: `1px solid ${type === 'danger' ? theme.palette.error.main : 
                                 type === 'warning' ? theme.palette.warning.main :
                                 theme.palette.primary.main}20`,
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.primary',
              lineHeight: 1.6,
              whiteSpace: 'pre-line'
            }}
          >
            {message}
          </Typography>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button 
          onClick={onCancel}
          variant="outlined"
          sx={{ 
              borderRadius: 3,
            textTransform: 'none',
            fontWeight: 500,
              px: 3,
              py: 1.5,
              borderColor: theme.palette.divider,
              color: 'text.secondary',
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }
          }}
        >
          {cancelText}
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained"
          color={getButtonColor()}
          sx={{ 
              borderRadius: 3,
            textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.5,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
          }}
        >
          {confirmText}
        </Button>
        </Box>
      </Box>
    </StyledDialog>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onNotificationCountChange
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
    type: 'warning'
  });
  
  const {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    markAllAsUnread,
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

  // Handle individual notification deletion - Direct deletion without confirmation
  const handleDeleteNotification = (id: string, message: string) => {
        deleteNotification(id);
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
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    sx={{ 
                      textTransform: 'none',
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                    }}
                  >
                    Mark all read
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={markAllAsUnread}
                    disabled={notifications.filter(n => n.read).length === 0}
                    sx={{ 
                      textTransform: 'none',
                      borderRadius: 2,
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                    }}
                  >
                    Mark all unread
                  </Button>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleDismissAll}
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    fontSize: '0.75rem',
                    minWidth: 'auto',
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