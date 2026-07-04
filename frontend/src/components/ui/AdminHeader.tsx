import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  Button,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  RefreshCw as RefreshIcon,
  Bell as NotificationsIcon,
  LogOut as LogoutIcon,
  ChevronRight as NavigateNextIcon,
} from 'lucide-react';
import { useAdminNavigation } from '../../context/AdminNavigationContext';
import { useFocusAnnouncement } from '../../hooks/useKeyboardNavigation';
import type { BreadcrumbItem, NotificationItem, AdminUser } from '../../context/AdminNavigationContext';



interface AdminHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  notifications?: NotificationItem[];
  user?: AdminUser | null;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  onLogout: () => void;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  breadcrumbs,
  notifications = [],
  user,
  onMenuClick,
  showMenuButton = false,
  onRefresh,
  refreshing = false,
  onLogout,
}) => {
  const theme = useTheme();
  const { markNotificationRead, clearNotifications } = useAdminNavigation();
  const { announce } = useFocusAnnouncement();
  
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(null);

  const unreadNotifications = notifications.filter(n => !n.read);

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchorEl(event.currentTarget);
    announce(`Notifications menu opened, ${unreadNotifications.length} unread notifications`, 'polite');
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
    announce('Notifications menu closed', 'polite');
  };

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
    announce('User menu opened', 'polite');
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
    announce('User menu closed', 'polite');
  };

  const handleNotificationItemClick = (notification: NotificationItem) => {
    if (!notification.read) {
      markNotificationRead(notification.id);
      announce(`Marked notification "${notification.title}" as read`, 'polite');
    }
  };

  const handleClearAllNotifications = () => {
    clearNotifications();
    handleNotificationClose();
    announce('All notifications cleared', 'polite');
  };

  const handleLogout = () => {
    handleUserMenuClose();
    announce('Logging out', 'polite');
    if (onLogout) {
      onLogout();
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
      announce('Refreshing data', 'polite');
    }
  };

  const getNotificationColor = (type: NotificationItem['type']) => {
    switch (type) {
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'success':
        return theme.palette.success.main;
      default:
        return theme.palette.info.main;
    }
  };

  const formatNotificationTime = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <header className="admin-header" role="banner">
      {/* Menu Toggle Button */}
      {showMenuButton && (
        <Tooltip title="Toggle Sidebar">
          <IconButton
            className="admin-icon-button admin-interactive"
            aria-label="Toggle navigation sidebar"
            aria-expanded={false}
            onClick={onMenuClick}
          >
            <MenuIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* Breadcrumbs */}
      <nav className="admin-breadcrumb" aria-label="Breadcrumb navigation">
        <ol style={{ display: 'flex', alignItems: 'center', gap: 'var(--admin-space-2)', margin: 0, padding: 0, listStyle: 'none' }}>
          {breadcrumbs.map((breadcrumb, index) => (
            <li key={index} className="admin-breadcrumb__item">
              <div className="admin-breadcrumb__icon" aria-hidden="true">
                {breadcrumb.icon}
              </div>
              <span 
                className={index === breadcrumbs.length - 1 ? 'admin-breadcrumb__current' : 'admin-breadcrumb__link'}
                aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
              >
                {breadcrumb.label}
              </span>
              {index < breadcrumbs.length - 1 && (
                <NavigateNextIcon
                  className="admin-breadcrumb__separator"
                  size={16}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Actions */}
      <div className="admin-header__actions" role="toolbar" aria-label="Header actions">
        {/* Refresh Button */}
        {onRefresh && (
          <Tooltip title={refreshing ? "Refreshing..." : "Refresh Data"}>
            <IconButton
              className={`admin-icon-button admin-interactive ${refreshing ? 'admin-icon-button--loading' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing data, please wait" : "Refresh data"}
              aria-describedby={refreshing ? "refresh-status" : undefined}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Notifications */}
        <Tooltip title={`Notifications (${unreadNotifications.length} unread)`}>
          <IconButton
            className="admin-icon-button admin-interactive"
            onClick={handleNotificationClick}
            aria-label={`Open notifications menu, ${unreadNotifications.length} unread notifications`}
            aria-haspopup="menu"
            aria-expanded={Boolean(notificationAnchorEl)}
          >
            <Badge 
              badgeContent={unreadNotifications.length} 
              color="error"
              aria-label={`${unreadNotifications.length} unread notifications`}
            >
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* User Menu */}
        <Tooltip title={`User menu for ${user?.username || 'Admin'}`}>
          <IconButton
            className="admin-icon-button admin-interactive"
            onClick={handleUserMenuClick}
            aria-label={`Open user menu for ${user?.username || 'Admin'}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(userMenuAnchorEl)}
          >
            <Avatar 
              sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}
              alt={`${user?.username || 'Admin'} avatar`}
            >
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </Avatar>
          </IconButton>
        </Tooltip>
      </div>

      {/* Notification Menu */}
      <Menu
        anchorEl={notificationAnchorEl}
        open={Boolean(notificationAnchorEl)}
        onClose={handleNotificationClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        sx={{
          '& .MuiPaper-root': {
            width: 320,
            maxHeight: 400,
            marginTop: 1,
          },
        }}
        MenuListProps={{
          'aria-label': 'Notifications menu',
          role: 'menu',
        }}
      >
        <div className="admin-card__header">
          <h3 className="admin-card__title" id="notifications-title">Notifications</h3>
          {notifications.length > 0 && (
            <Button 
              size="small" 
              onClick={handleClearAllNotifications}
              aria-label="Clear all notifications"
            >
              Clear All
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="admin-p-4 admin-text-center" role="status">
            <span className="admin-text-secondary">No notifications</span>
          </div>
        ) : (
          <div 
            style={{ maxHeight: 300, overflowY: 'auto' }}
            role="region"
            aria-labelledby="notifications-title"
          >
            {notifications.slice(0, 10).map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationItemClick(notification)}
                role="menuitem"
                aria-label={`${notification.read ? 'Read' : 'Unread'} ${notification.type} notification: ${notification.title}. ${notification.message}. ${formatNotificationTime(notification.timestamp)}`}
                sx={{
                  padding: 2,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  opacity: notification.read ? 0.7 : 1,
                  backgroundColor: notification.read ? 'transparent' : theme.palette.action.hover,
                  '&:last-child': {
                    borderBottom: 'none',
                  },
                }}
              >
                <div className="admin-flex admin-items-start admin-gap-2">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: getNotificationColor(notification.type),
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <div style={{ flexGrow: 1 }}>
                    <div className="admin-font-weight-semibold">
                      {notification.title}
                    </div>
                    <div className="admin-text-secondary admin-mt-1">
                      {notification.message}
                    </div>
                    <div className="admin-text-xs admin-text-secondary admin-mt-1">
                      {formatNotificationTime(notification.timestamp)}
                    </div>
                  </div>
                </div>
              </MenuItem>
            ))}
          </div>
        )}
      </Menu>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchorEl}
        open={Boolean(userMenuAnchorEl)}
        onClose={handleUserMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        MenuListProps={{
          'aria-label': 'User menu',
          role: 'menu',
        }}
      >
        <div className="admin-p-4" style={{ minWidth: 200 }} role="presentation">
          <div className="admin-font-weight-semibold" id="user-info-name">
            {user?.username || 'Admin'}
          </div>
          <div className="admin-text-secondary" id="user-info-role">
            {user?.role || 'Administrator'}
          </div>
          {user?.lastLogin && (
            <div className="admin-text-xs admin-text-secondary" id="user-info-login">
              Last login: {user.lastLogin.toLocaleDateString()}
            </div>
          )}
        </div>
        <Divider />
        <MenuItem 
          onClick={handleLogout}
          role="menuitem"
          aria-label="Logout from admin panel"
        >
          <LogoutIcon style={{ marginRight: 8 }} aria-hidden="true" />
          Logout
        </MenuItem>
      </Menu>
    </header>
  );
};

export default AdminHeader;