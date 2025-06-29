import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  X, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Trash2,
  RefreshCw,
  ArchiveRestore,
  Settings,
  BookmarkCheck,
  MessageCircle,
  ShieldAlert,
  TrendingUp,
  Activity,
  BadgeCheck,
  Circle,
  User,
  Compass,
  BarChart3,
  Settings2,
  Tag,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
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
  useTheme,
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
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  zIndex: 1300, // Below confirmation dialogs
  display: 'flex',
  flexDirection: 'column',
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
    background: theme.palette.grey[100],
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.grey[400],
    borderRadius: 4,
    border: `1px solid ${theme.palette.grey[100]}`,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: theme.palette.grey[500],
  },
}));

const NotificationItemActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginLeft: 'auto',
  paddingLeft: '12px',
  opacity: 0,
  transition: 'opacity 0.2s ease-in-out',
  '&.notification-item-actions': {},
});

const NotificationItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUnread',
})<{ isUnread?: boolean }>(({ theme, isUnread }) => ({
  padding: theme.spacing(1.5, 2),
  margin: theme.spacing(0.75, 1),
  borderRadius: 8,
  border: `1px solid transparent`,
  backgroundColor: isUnread ? `${theme.palette.primary.main}08` : 'transparent',
  transition: 'all 0.2s ease',
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: theme.palette.grey[50],
    borderColor: theme.palette.divider,
    '& .notification-item-actions': {
      opacity: 1,
    }
  },
}));

const NotificationActions = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: theme.palette.grey[50],
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: theme.palette.grey[100],
  },
  animation: isPulsing ? `${pulse} 1.5s infinite` : 'none',
  '& svg': {
    animation: isPulsing ? `${pulse} 1.5s infinite` : 'none',
  },
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  zIndex: 1400, // Above notification center (1300)
  '& .MuiDialog-paper': {
    borderRadius: 12,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    const iconProps = { size: 18, strokeWidth: 2 };
    
    switch (type) {
      case 'success':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.success.main}12`,
              color: theme.palette.success.main,
              border: `1px solid ${theme.palette.success.main}25`,
            }}
          >
            <BadgeCheck {...iconProps} />
          </Box>
        );
      case 'error':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.error.main}12`,
              color: theme.palette.error.main,
              border: `1px solid ${theme.palette.error.main}25`,
            }}
          >
            <ShieldAlert {...iconProps} />
          </Box>
        );
      case 'warning':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.warning.main}12`,
              color: theme.palette.warning.main,
              border: `1px solid ${theme.palette.warning.main}25`,
            }}
          >
            <AlertTriangle {...iconProps} />
          </Box>
        );
      case 'info':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.primary.main}12`,
              color: theme.palette.primary.main,
              border: `1px solid ${theme.palette.primary.main}25`,
            }}
          >
            <MessageCircle {...iconProps} />
          </Box>
        );
      case 'trending':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.secondary.main}12`,
              color: theme.palette.secondary.main,
              border: `1px solid ${theme.palette.secondary.main}25`,
            }}
          >
            <TrendingUp {...iconProps} />
          </Box>
        );
      case 'activity':
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.primary.main}12`,
              color: theme.palette.primary.main,
              border: `1px solid ${theme.palette.primary.main}25`,
            }}
          >
            <Activity {...iconProps} />
          </Box>
        );
      default:
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: `${theme.palette.grey[400]}12`,
              color: theme.palette.grey[600],
              border: `1px solid ${theme.palette.grey[400]}25`,
            }}
          >
            <Circle {...iconProps} />
          </Box>
        );
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
  const handleDeleteNotification = (id: string) => {
        deleteNotification(id);
  };

  // Format timestamp helper - simplified version
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      if (!isValid(date)) {
        return '';
      }
      
      const now = new Date();
      const diffInMinutes = Math.abs(now.getTime() - date.getTime()) / (1000 * 60);
      const diffInHours = diffInMinutes / 60;
      const diffInDays = diffInHours / 24;
      
      // Simplified time format
      if (diffInMinutes < 1) {
        return 'now';
      } else if (diffInMinutes < 60) {
        return `${Math.floor(diffInMinutes)}m`;
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h`;
      } else if (diffInDays < 7) {
        return `${Math.floor(diffInDays)}d`;
      } else {
        return format(date, 'MMM d');
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
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

  const getCategoryInfo = (category?: string | null) => {
    if (!category) {
      return null;
    }
    
    const iconProps = { size: 14, strokeWidth: 1.5, style: { verticalAlign: 'middle' } };

    switch (category.toLowerCase()) {
      case 'store connection':
      case 'profile':
        return { icon: <User {...iconProps} />, name: 'Profile' };
      case 'discovery':
      case 'competitors':
      case 'mode':
        return { icon: <Compass {...iconProps} />, name: 'Market Intelligence' };
      case 'analytics':
      case 'dashboard':
        return { icon: <BarChart3 {...iconProps} />, name: 'Analytics' };
      case 'system':
        return { icon: <Settings2 {...iconProps} />, name: 'System' };
      default:
        return { icon: <Tag {...iconProps} />, name: category };
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
                <Tooltip title="Notification settings">
                  <IconButton 
                    size="small" 
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                        backgroundColor: 'primary.light' + '12',
                        transition: 'all 0.2s ease'
                      }
                    }}
                  >
                    <Settings size={16} strokeWidth={2} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                  <IconButton 
                    size="small" 
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'info.main',
                        backgroundColor: 'info.light' + '12',
                        transition: 'all 0.2s ease'
                      },
                      '&:disabled': {
                        color: 'text.disabled',
                      }
                    }}
                  >
                    <RefreshCw size={16} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close">
                  <IconButton 
                    size="small" 
                    onClick={() => setIsOpen(false)}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'error.main',
                        backgroundColor: 'error.light' + '12',
                        transition: 'all 0.2s ease'
                      }
                    }}
                  >
                    <X size={16} strokeWidth={2} />
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
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Unable to load notifications
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {error.includes('500') || error.includes('Internal Server Error') 
                        ? "We're experiencing temporary issues. Please try again in a moment."
                        : error.includes('404') || error.includes('Not Found')
                        ? "Notifications service is currently unavailable."
                        : error.includes('403') || error.includes('Unauthorized')
                        ? "Please refresh your connection and try again."
                        : "Please check your connection and try again."
                      }
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleRefresh}
                      disabled={refreshing}
                      sx={{ mt: 1, textTransform: 'none' }}
                    >
                      {refreshing ? 'Retrying...' : 'Try Again'}
                    </Button>
                  </Alert>
                </Box>
              )}

              {!loading && !error && notifications.length === 0 && (
                <Box p={4} textAlign="center" sx={{ color: 'text.secondary' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      backgroundColor: 'grey.50',
                      margin: '0 auto 16px',
                      border: '2px dashed',
                      borderColor: 'grey.200',
                    }}
                  >
                    <Bell size={32} style={{ opacity: 0.5 }} strokeWidth={1.5} />
                  </Box>
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
                    
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {(() => {
                        const categoryInfo = getCategoryInfo(notification.category);
                        const timestamp = formatTimestamp(notification.createdAt);
                        
                        if (!categoryInfo && !timestamp) return null;
                        
                        return (
                          <>
                            {categoryInfo && (
                              <Tooltip title={categoryInfo.name} placement="top">
                                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                  {categoryInfo.icon}
                                </Box>
                              </Tooltip>
                            )}
                            {categoryInfo && timestamp && <Box component="span">•</Box>}
                            {timestamp && <span>{timestamp}</span>}
                          </>
                        );
                      })()}
                    </Typography>
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
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            '&:hover': { 
                              color: 'success.main', 
                              backgroundColor: 'success.light' + '12',
                              transition: 'all 0.2s ease'
                            } 
                          }}
                        >
                          <BookmarkCheck size={16} strokeWidth={2} />
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteNotification(notification.id)}
                         sx={{ 
                           color: 'text.secondary',
                           width: 32,
                           height: 32,
                           borderRadius: '50%',
                           '&:hover': { 
                             color: 'error.main', 
                             backgroundColor: 'error.light' + '12',
                             transition: 'all 0.2s ease'
                           } 
                         }}
                      >
                        <Trash2 size={16} strokeWidth={2} />
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
                  <Tooltip title="Mark all read">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={markAllAsRead}
                      disabled={unreadCount === 0}
                      sx={{ 
                        textTransform: 'none',
                        borderRadius: 1,
                        minWidth: 'auto',
                        px: 1,
                        py: 1,
                        borderColor: 'success.main',
                        color: 'success.main',
                        '&:hover': {
                          backgroundColor: 'success.light' + '12',
                          borderColor: 'success.dark',
                          transition: 'all 0.2s ease'
                        }
                      }}
                    >
                      <BookmarkCheck size={16} strokeWidth={2} />
                    </Button>
                  </Tooltip>
                  <Tooltip title="Mark all unread">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={markAllAsUnread}
                      disabled={notifications.filter(n => n.read).length === 0}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 1,
                        minWidth: 'auto',
                        px: 1,
                        py: 1,
                        borderColor: 'warning.main',
                        color: 'warning.main',
                        '&:hover': {
                          backgroundColor: 'warning.light' + '12',
                          borderColor: 'warning.dark',
                          transition: 'all 0.2s ease'
                        }
                      }}
                    >
                      <ArchiveRestore size={16} strokeWidth={2} />
                    </Button>
                  </Tooltip>
                </Box>
                <Tooltip title="Clear all notifications">
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleDismissAll}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 1,
                      minWidth: 'auto',
                      px: 1,
                      py: 1,
                      borderColor: 'error.main',
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.light' + '12',
                        borderColor: 'error.dark',
                        transition: 'all 0.2s ease'
                      }
                    }}
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </Button>
                </Tooltip>
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
