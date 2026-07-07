import React, { useState, useEffect } from 'react';
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
  Shield,
  Wifi,
  Megaphone,
  Inbox,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';
import { useNotificationSettings } from '../../context/NotificationSettingsContext';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Badge,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Switch,
  FormControlLabel,
  Divider,
  Tab,
  Tabs,
  useTheme,
  Tooltip,
  Alert,
} from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';

// eslint-disable-next-line no-unused-vars
type NotificationCountChangeHandler = (count: number) => void;

interface NotificationCenterProps {
  onNotificationCountChange?: NotificationCountChangeHandler;
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

interface NotificationSettings {
  showToasts: boolean;
  soundEnabled: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  marketingNotifications: boolean;
}

// eslint-disable-next-line no-unused-vars
type NotificationSettingChangeHandler = (key: keyof NotificationSettings, value: boolean) => void;

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
const NotificationHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.25, 2.5),
  backgroundColor: '#101820',
  color: '#ffffff',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
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
  shouldForwardProp: (prop) => prop !== 'isUnread' && prop !== 'isGrouped',
})<{ isUnread?: boolean; isGrouped?: boolean }>(({ theme, isUnread }) => ({
  padding: theme.spacing(2),
  margin: theme.spacing(1),
  borderRadius: 8,
  border: `1px solid ${isUnread ? 'rgba(47, 91, 234, 0.24)' : theme.palette.divider}`,
  backgroundColor: isUnread ? 'rgba(47, 91, 234, 0.06)' : theme.palette.background.paper,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  boxShadow: '0 14px 34px -30px rgb(16 24 32 / 0.65)',
  '&:hover': {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(47, 91, 234, 0.30)',
    transform: 'translateY(-1px)',
    boxShadow: '0 22px 46px -34px rgb(16 24 32 / 0.75)',
    '& .notification-item-actions': {
      opacity: 1,
    }
  },
  '&:before': isUnread ? {
    content: '""',
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 3,
    height: '60%',
    backgroundColor: '#2f5bea',
    borderRadius: '0 2px 2px 0',
  } : {},
}));

// New styled component for notification groups
// const NotificationGroup = styled(Box)(({ theme }) => ({
//   marginBottom: theme.spacing(1),
//   '&:last-child': {
//     marginBottom: 0,
//   },
// }));

const NotificationActions = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2.5),
  backgroundColor: '#f7f9f6',
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
  zIndex: 1500,
  '& .MuiDialog-paper': {
    borderRadius: 12,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    overflow: 'hidden',
  },
  '& .MuiBackdrop-root': {
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(16, 24, 32, 0.42)',
  },
}));

const NotificationSettingsDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: NotificationSettings;
  onSettingsChange: NotificationSettingChangeHandler;
}> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const theme = useTheme();

  const handleSettingChange = (key: string, value: boolean) => {
    onSettingsChange(key as keyof NotificationSettings, value);
  };

  return (
    <StyledDialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ 
        fontWeight: 600, 
        borderBottom: `1px solid ${theme.palette.divider}`,
        pb: 2 
      }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Settings size={24} color={theme.palette.primary.main} />
          Notification Settings
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Box display="flex" flexDirection="column" gap={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              General Settings
            </Typography>
            <Box display="flex" flexDirection="column" gap={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showToasts}
                    onChange={(e) => handleSettingChange('showToasts', e.target.checked)}
                    color="primary"
                  />
                }
                label="Show Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.soundEnabled}
                    onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label="Sound notifications"
              />
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Notification Types
            </Typography>
            <Box display="flex" flexDirection="column" gap={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.systemNotifications}
                    onChange={(e) => handleSettingChange('systemNotifications', e.target.checked)}
                    color="primary"
                  />
                }
                label="System & security notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                    color="primary"
                  />
                }
                label="Analytics & insights notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.marketingNotifications}
                    onChange={(e) => handleSettingChange('marketingNotifications', e.target.checked)}
                    color="primary"
                  />
                }
                label="Feature updates & tips"
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ textTransform: 'none' }}
        >
          Close
        </Button>
        <Button 
          onClick={() => {
            // Show confirmation that settings were saved
            if ((window as any).showNotificationSettingsSaved) {
              (window as any).showNotificationSettingsSaved();
            }
            onClose();
          }}
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          Save Changes
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
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
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const { settings, updateSetting } = useNotificationSettings();

  // Expose settings saved callback for confirmation
  useEffect(() => {
    (window as any).showNotificationSettingsSaved = () => {
      // Show a brief confirmation toast
      if (!(window as any).settingsToastShown) {
        (window as any).settingsToastShown = true;
        setTimeout(() => {
          (window as any).settingsToastShown = false;
        }, 3000);
      }
    };
  }, []);

  // Update parent component about count changes
  useEffect(() => {
    onNotificationCountChange?.(unreadCount);
  }, [unreadCount, onNotificationCountChange]);

  // Allow the command palette (and others) to open the panel
  useEffect(() => {
    const openHandler = () => setIsOpen(true);
    window.addEventListener('shopgauge:open-notifications', openHandler);
    return () => window.removeEventListener('shopgauge:open-notifications', openHandler);
  }, []);

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

    const categoryToken = (color: string) => ({
      color,
      bgColor: alpha(color, 0.09),
      borderColor: alpha(color, 0.22),
    });

    const createCategoryIcon = (
      Icon: React.ElementType,
      color: string,
      bgColor: string,
      borderColor: string,
      variant: 'item' | 'meta',
    ) => {
      const isItemIcon = variant === 'item';

      return (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isItemIcon ? 36 : 20,
            height: isItemIcon ? 36 : 20,
            borderRadius: isItemIcon ? '50%' : '6px',
            backgroundColor: bgColor,
            border: `1px solid ${borderColor}`,
            color,
            flexShrink: 0,
            boxShadow: isItemIcon ? `0 12px 24px -18px ${alpha(color, 0.75)}` : 'none',
            transition: 'transform 0.2s ease, background-color 0.2s ease',
          }}
        >
          <Icon size={isItemIcon ? 18 : 14} strokeWidth={2} />
        </Box>
      );
    };

    const primaryToken = categoryToken(theme.palette.primary.main);
    const marketToken = categoryToken(theme.palette.secondary.main);
    const analyticsToken = categoryToken(theme.palette.info.main);
    const systemToken = categoryToken(theme.palette.grey[600]);

    const categoryMap: Record<string, {
      Icon: React.ElementType;
      name: string;
      color: string;
      bgColor: string;
      borderColor: string;
    }> = {
      'store connection': {
        Icon: User,
        name: 'Profile',
        ...primaryToken,
      },
      'profile': {
        Icon: User,
        name: 'Profile',
        ...primaryToken,
      },

      'discovery': {
        Icon: Compass,
        name: 'Market Intelligence',
        ...marketToken,
      },
      'competitors': {
        Icon: Compass,
        name: 'Market Intelligence',
        ...marketToken,
      },
      'mode': {
        Icon: Compass,
        name: 'Market Intelligence',
        ...marketToken,
      },
      'market intelligence': {
        Icon: Compass,
        name: 'Market Intelligence',
        ...marketToken,
      },

      'analytics': {
        Icon: BarChart3,
        name: 'Analytics',
        ...analyticsToken,
      },
      'dashboard': {
        Icon: BarChart3,
        name: 'Analytics',
        ...analyticsToken,
      },
      'revenue': {
        Icon: BarChart3,
        name: 'Analytics',
        ...analyticsToken,
      },
      'performance': {
        Icon: BarChart3,
        name: 'Analytics',
        ...analyticsToken,
      },

      'system': {
        Icon: Settings2,
        name: 'System',
        ...systemToken,
      },
      'system health': {
        Icon: Settings2,
        name: 'System',
        ...systemToken,
      },

      'authentication': {
        Icon: Shield,
        name: 'Security',
        ...categoryToken(theme.palette.warning.main),
      },
      'session security': {
        Icon: Shield,
        name: 'Security',
        ...categoryToken(theme.palette.warning.main),
      },
      'security & audit': {
        Icon: Shield,
        name: 'Security',
        ...categoryToken(theme.palette.warning.main),
      },

      'connection': {
        Icon: Wifi,
        name: 'Connection',
        ...categoryToken(theme.palette.error.main),
      },

      'marketing': {
        Icon: Megaphone,
        name: 'Marketing',
        ...primaryToken,
      },

      'default': {
        Icon: Tag,
        name: 'General',
        ...systemToken,
      }
    };

    const categoryKey = category.toLowerCase();
    const categoryInfo = categoryMap[categoryKey] || categoryMap['default'];

    return {
      itemIcon: createCategoryIcon(
        categoryInfo.Icon,
        categoryInfo.color,
        categoryInfo.bgColor,
        categoryInfo.borderColor,
        'item',
      ),
      metaIcon: createCategoryIcon(
        categoryInfo.Icon,
        categoryInfo.color,
        categoryInfo.bgColor,
        categoryInfo.borderColor,
        'meta',
      ),
      name: categoryInfo.name,
      color: categoryInfo.color,
      bgColor: categoryInfo.bgColor,
      borderColor: categoryInfo.borderColor
    };
  };

  return (
    <>
      {/* Notification Bell Button */}
      <Tooltip title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}>
        <BellButton
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          isPulsing={unreadCount > 0}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <Bell size={24} />
          </Badge>
        </BellButton>
      </Tooltip>

      {/* Notification Panel — right-anchored drawer, never clipped */}
      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        sx={{
          zIndex: 1400,
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(16, 24, 32, 0.35)',
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#ffffff',
            backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #f7f9f6 100%)',
            borderLeft: '1px solid #e4e7eb',
            borderRadius: 0,
            boxShadow: '-24px 0 60px -40px rgba(16, 24, 32, 0.5)',
          },
        }}
      >
            {/* Header */}
            <NotificationHeader>
              <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
                <Box minWidth={0}>
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#ffffff', lineHeight: 1.15 }}>
                      Notifications
                    </Typography>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.35,
                        borderRadius: 999,
                        color: '#c8d4ff',
                        backgroundColor: 'rgba(47, 91, 234, 0.22)',
                        border: '1px solid rgba(185, 200, 255, 0.18)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {unreadCount} unread
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.58)', fontWeight: 600, lineHeight: 1.5 }}
                  >
                    Revenue, inventory, and competitor activity
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                  <Tooltip title="Notification settings">
                    <IconButton
                      size="small"
                      onClick={() => setIsSettingsOpen(true)}
                      sx={{
                        color: 'rgba(255,255,255,0.72)',
                        width: 32,
                        height: 32,
                        '&:hover': {
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.10)',
                          transition: 'all 0.2s ease',
                        },
                      }}
                    >
                      <Settings size={14} strokeWidth={2} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Refresh">
                    <IconButton
                      size="small"
                      onClick={handleRefresh}
                      disabled={refreshing || loading}
                      sx={{
                        color: 'rgba(255,255,255,0.72)',
                        width: 32,
                        height: 32,
                        '&:hover': {
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.10)',
                          transition: 'all 0.2s ease',
                        },
                        '&:disabled': {
                          color: 'rgba(255,255,255,0.3)',
                        },
                      }}
                    >
                      <RefreshCw size={14} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Close">
                    <IconButton
                      size="small"
                      onClick={() => setIsOpen(false)}
                      sx={{
                        color: 'rgba(255,255,255,0.72)',
                        width: 32,
                        height: 32,
                        '&:hover': {
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.10)',
                          transition: 'all 0.2s ease',
                        },
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255,255,255,0.52)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {notifications.length} total
                </Typography>
                <Button
                  size="small"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  startIcon={<BookmarkCheck size={14} strokeWidth={2} />}
                  sx={{
                    minHeight: 32,
                    px: 1.25,
                    borderRadius: 2,
                    color: '#ffffff',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    textTransform: 'none',
                    fontWeight: 800,
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.16)',
                    },
                    '&.Mui-disabled': {
                      color: 'rgba(255,255,255,0.34)',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    },
                  }}
                >
                  Mark all read
                </Button>
              </Box>
            </NotificationHeader>

            {/* All / Unread tabs */}
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              sx={{
                px: 2,
                minHeight: 44,
                borderBottom: '1px solid #e4e7eb',
                flexShrink: 0,
                '& .MuiTab-root': { minHeight: 44, py: 0, px: 2, fontWeight: 700, fontSize: '0.875rem' },
              }}
            >
              <Tab value="all" label={`All${notifications.length > 0 ? ` (${notifications.length})` : ''}`} />
              <Tab value="unread" label={`Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`} />
            </Tabs>

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

              {!loading && !error && (activeTab === 'unread' ? unreadCount === 0 : notifications.length === 0) && (
                <Box p={5} textAlign="center" sx={{ color: 'text.secondary' }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 88,
                      height: 88,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(47, 91, 234, 0.08)',
                      margin: '0 auto 20px',
                    }}
                  >
                    <Inbox size={36} color="#2f5bea" strokeWidth={1.75} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
                    You're all caught up
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {activeTab === 'unread'
                      ? 'No unread notifications right now.'
                      : 'Alerts about revenue, inventory, and competitors will appear here.'}
                  </Typography>
                </Box>
              )}

              {!loading && !error && notifications.length > 0 && (() => {
                // Sort newest first, then apply the active tab filter
                const sortedNotifications = [...notifications]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .filter((n) => (activeTab === 'unread' ? !n.read : true));

                return sortedNotifications.map((notification) => {
                  const categoryInfo = getCategoryInfo(notification.category);
                  const timestamp = formatTimestamp(notification.createdAt);

                  return (
                    <NotificationItem
                      key={notification.id}
                      isUnread={!notification.read}
                      isGrouped={false}
                      className="notification-item"
                    >
                      <Box mt={0.25}>
                        {categoryInfo?.itemIcon || getNotificationIcon(notification.type)}
                      </Box>

                      <Box flex={1} minWidth={0}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: notification.read ? 500 : 750,
                            color: 'text.primary',
                            mb: 0.75,
                            wordBreak: 'break-word',
                            lineHeight: 1.45,
                          }}
                        >
                          {notification.message}
                        </Typography>

                        {(categoryInfo || timestamp) && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              fontWeight: 650,
                              minHeight: 22,
                            }}
                          >
                            {categoryInfo && (
                              <Tooltip title={categoryInfo.name} placement="top">
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    minWidth: 0,
                                  }}
                                >
                                  {categoryInfo.metaIcon}
                                  <Box component="span" sx={{ color: categoryInfo.color }}>
                                    {categoryInfo.name}
                                  </Box>
                                </Box>
                              </Tooltip>
                            )}
                            {categoryInfo && timestamp && (
                              <Box component="span" sx={{ color: 'text.disabled' }}>
                                •
                              </Box>
                            )}
                            {timestamp && <Box component="span">{timestamp}</Box>}
                          </Typography>
                        )}
                      </Box>

                      <NotificationItemActions className="notification-item-actions">
                        {!notification.read && (
                          <Tooltip title="Mark as read">
                            <IconButton
                              size="small"
                              onClick={() => markAsRead(notification.id)}
                              sx={{
                                color: 'text.secondary',
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                '&:hover': {
                                  color: 'success.main',
                                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                                  transition: 'all 0.2s ease',
                                },
                              }}
                            >
                              <BookmarkCheck size={14} strokeWidth={2} />
                            </IconButton>
                          </Tooltip>
                        )}

                        {notification.read && (
                          <Tooltip title="Mark as unread">
                            <IconButton
                              size="small"
                              onClick={() => markAsUnread(notification.id)}
                              sx={{
                                color: 'text.secondary',
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                '&:hover': {
                                  color: 'warning.main',
                                  backgroundColor: alpha(theme.palette.warning.main, 0.1),
                                  transition: 'all 0.2s ease',
                                },
                              }}
                            >
                              <ArchiveRestore size={14} strokeWidth={2} />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNotification(notification.id)}
                            sx={{
                              color: 'text.secondary',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              '&:hover': {
                                color: 'error.main',
                                backgroundColor: alpha(theme.palette.error.main, 0.1),
                                transition: 'all 0.2s ease',
                              },
                            }}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </IconButton>
                        </Tooltip>
                      </NotificationItemActions>
                    </NotificationItem>
                  );
                });
              })()}
            </NotificationContent>

            {/* Actions */}
            <NotificationActions>
              <Button
                size="small"
                onClick={() => setIsSettingsOpen(true)}
                startIcon={<Settings size={16} strokeWidth={2} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 750,
                  minHeight: 36,
                  px: 1.5,
                  color: '#2f5bea',
                  '&:hover': { backgroundColor: 'rgba(47, 91, 234, 0.08)' },
                }}
              >
                Notification settings
              </Button>
              <Box
                component="span"
                aria-hidden="true"
                sx={{ color: 'text.disabled', fontWeight: 800 }}
              >
                •
              </Box>
              <Button
                size="small"
                color="error"
                onClick={handleDismissAll}
                disabled={notifications.length === 0}
                startIcon={<Trash2 size={16} strokeWidth={2} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 750,
                  minHeight: 36,
                  px: 1.5,
                  '&:hover': { backgroundColor: 'rgba(220, 38, 38, 0.08)' },
                }}
              >
                Clear all
              </Button>
            </NotificationActions>
      </Drawer>

      {/* Notification Settings Dialog */}
      <NotificationSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={updateSetting}
      />

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
