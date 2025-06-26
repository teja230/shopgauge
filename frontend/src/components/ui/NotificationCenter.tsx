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
  Clock,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationCenterProps {
  onNotificationCountChange?: (count: number) => void;
  position?: 'top-right' | 'top-center';
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
  if (!isOpen) return null;

  const typeColors = {
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: 'text-amber-500',
      button: 'bg-amber-600 hover:bg-amber-700'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'text-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const colors = typeColors[type];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl border border-gray-200 p-6 mx-4 max-w-md w-full">
        <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 mb-4`}>
          <div className="flex items-start gap-3">
            <div className={`${colors.icon} mt-0.5`}>
              {type === 'danger' && <AlertCircle className="w-5 h-5" />}
              {type === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {type === 'info' && <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-700">{message}</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white ${colors.button} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-opacity-50 transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onNotificationCountChange,
  position = 'top-right'
}) => {
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
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-600" />;
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

  // Handle individual notification deletion with confirmation
  const handleDeleteNotification = (id: string, message: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Notification',
      message: `Are you sure you want to delete this notification: "${message.length > 50 ? message.substring(0, 50) + '...' : message}"?`,
      type: 'danger',
      onConfirm: () => {
        deleteNotification(id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Enhanced timestamp formatting with proper timezone support
  const formatTimestamp = (timestamp: string) => {
    try {
      let date: Date;
      
      // Handle different timestamp formats
      if (timestamp.includes('T')) {
        date = parseISO(timestamp);
      } else {
        date = new Date(timestamp);
      }

      if (!isValid(date)) {
        return 'Invalid date';
      }

      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      // For very recent notifications (< 1 hour), show relative time
      if (diffInHours < 1) {
        return formatDistanceToNow(date, { addSuffix: true });
      }
      
      // For notifications from today, show time
      if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
        return format(date, 'h:mm a');
      }
      
      // For notifications from this week, show day and time
      if (diffInHours < 168) { // 7 days
        return format(date, 'EEE h:mm a');
      }
      
      // For older notifications, show full date
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  // Calculate proper positioning based on navbar
  const getDropdownPosition = () => {
    if (position === 'top-center') {
      return {
        position: 'absolute' as const,
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        marginTop: '8px'
      };
    } else {
      return {
        position: 'absolute' as const,
        top: '100%',
        right: '0',
        zIndex: 50,
        marginTop: '8px'
      };
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-white bg-transparent hover:text-gray-200 hover:bg-white/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-0"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          {/* Change bell color when there are unread notifications */}
          <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-red-400' : 'text-white'}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        {isOpen && (
            <div 
              className="absolute w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
              style={getDropdownPosition()}
            >
              {/* Header with theme colors */}
              <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    <h3 className="font-semibold">Notifications</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchNotifications}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                      title="Refresh notifications"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <p className="text-xs text-blue-100 mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                    {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Content with proper scrolling */}
              <div className="max-h-96 overflow-y-auto notification-center-content">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-3 text-gray-500 text-sm">Loading notifications...</p>
                  </div>
                ) : error ? (
                  <div className="p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                    <p className="text-red-600 font-medium text-sm mb-2">Failed to load notifications</p>
                    <p className="text-gray-500 text-xs mb-4">{error}</p>
                    <button
                      onClick={fetchNotifications}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </button>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium text-sm">All clear!</p>
                    <p className="text-gray-400 text-xs mt-1">No notifications to show</p>
                  </div>
                ) : (
                  <>
                    {notifications.map((notification, index) => (
                      <div
                        key={notification.id}
                        className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                          !notification.read ? 'bg-blue-50/30 border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {getNotificationIcon(notification.type)}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className={`text-sm leading-5 ${
                                  !notification.read ? 'font-medium text-gray-900' : 'text-gray-700'
                                }`}>
                                  {notification.message}
                                </p>
                                {!notification.read && (
                                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                                )}
                              </div>
                              
                              {notification.category && (
                                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full mb-2">
                                  {notification.category}
                                </span>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTimestamp(notification.createdAt)}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                  {!notification.read && (
                                    <button
                                      onClick={() => markAsRead(notification.id)}
                                      className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                                    >
                                      Mark read
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteNotification(notification.id, notification.message)}
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                    title="Delete notification"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer with enhanced controls */}
              {notifications.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="flex justify-between items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Mark all read ({unreadCount})
                      </button>
                    )}
                    <button
                      onClick={handleDismissAll}
                      className="text-xs text-gray-500 hover:text-red-600 font-medium flex items-center gap-1 ml-auto px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear all ({notifications.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
        )}
      </div>

      {/* Custom Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}; 