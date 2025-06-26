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
  position?: 'dropdown'; // Simplified to just dropdown positioning
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

// Custom hook for responsive design
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onNotificationCountChange,
  position = 'dropdown'
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
  const isMobile = useIsMobile();
  
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

  // Get icon for notification type with improved colors
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
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
        // For recent notifications, show relative time
        return formatDistanceToNow(date, { addSuffix: true });
      }
      
      // For older notifications, show full date
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Button - Improved styling */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-white bg-transparent hover:text-gray-200 hover:bg-white/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-0"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'text-yellow-400 animate-pulse' : 'text-white'}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown - Positioned below navbar */}
        {isOpen && (
          <div 
            className={`fixed bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50 ${
              isMobile 
                ? 'left-4 right-4 top-16' // Full width on mobile, positioned below navbar
                : 'w-96 right-0 top-full mt-2' // Desktop positioning
            }`}
            style={{
              // Ensure proper positioning below navbar
              ...(isMobile ? {
                maxHeight: 'calc(100vh - 80px)', // Leave space for navbar
              } : {
                maxHeight: 'calc(100vh - 100px)', // Leave space for navbar + padding
              })
            }}
          >
            {/* Header with improved theme colors */}
            <div className="px-4 py-3 bg-slate-800 text-white">
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
                <p className="text-xs text-slate-200 mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                  {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Content with proper scrolling */}
            <div className={`overflow-y-auto ${isMobile ? 'max-h-[60vh]' : 'max-h-80'}`}>
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
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
                        !notification.read ? 'bg-slate-50 border-l-4 border-l-slate-600' : ''
                      }`}
                    >
                      <div className={`${isMobile ? 'p-4' : 'p-4'}`}>
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className={`${isMobile ? 'text-sm' : 'text-sm'} leading-5 ${
                                !notification.read ? 'font-medium text-gray-900' : 'text-gray-700'
                              }`}>
                                {notification.message}
                              </p>
                              {!notification.read && (
                                <span className={`bg-slate-600 rounded-full mt-1 flex-shrink-0 ${
                                  isMobile ? 'w-2.5 h-2.5' : 'w-2 h-2'
                                }`}></span>
                              )}
                            </div>
                            
                            {notification.category && (
                              <span className={`inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded-full mb-2 ${
                                isMobile ? 'text-xs' : 'text-xs'
                              }`}>
                                {notification.category}
                              </span>
                            )}
                            
                            <div className="flex items-center justify-between">
                              <span className={`text-gray-500 flex items-center gap-1 ${
                                isMobile ? 'text-xs' : 'text-xs'
                              }`}>
                                <Clock className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3'}`} />
                                {formatTimestamp(notification.createdAt)}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                {!notification.read && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className={`text-slate-600 hover:text-slate-700 font-medium rounded hover:bg-slate-100 transition-colors ${
                                      isMobile 
                                        ? 'text-xs px-2 py-1.5 min-h-[36px]' 
                                        : 'text-xs px-2 py-1'
                                    }`}
                                  >
                                    Mark read
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteNotification(notification.id, notification.message)}
                                  className={`text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-red-50 ${
                                    isMobile 
                                      ? 'p-1.5 min-h-[36px] min-w-[36px]' 
                                      : 'p-1'
                                  }`}
                                  title="Delete notification"
                                >
                                  <X className={`${isMobile ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Footer with actions */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                      <div className="flex items-center justify-between gap-3">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-sm text-slate-600 hover:text-slate-700 font-medium transition-colors flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" />
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={handleDismissAll}
                          className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear all
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        type={confirmDialog.type}
        confirmText={confirmDialog.type === 'danger' ? 'Delete' : 'Confirm'}
      />
    </>
  );
}; 