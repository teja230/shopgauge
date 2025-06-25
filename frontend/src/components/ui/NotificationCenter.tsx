import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Check,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../hooks/useNotifications';

interface NotificationCenterProps {
  onNotificationCountChange?: (count: number) => void;
  position?: 'top-right' | 'top-center';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  onNotificationCountChange,
  position = 'top-right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

  // Close dropdown when scrolling to prevent floating over content
  useEffect(() => {
    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  // Handle dismiss all notifications
  const handleDismissAll = () => {
    if (window.confirm('Clear all notifications?')) {
      clearAll();
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid date';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-gray-200 hover:bg-white/10 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {unreadCount > 0 && (
                <p className="text-xs text-blue-100 mt-1">
                  {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="mt-3 text-gray-500 text-sm">Loading...</p>
                </div>
              ) : error ? (
                <div className="p-6 text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                  <p className="text-red-600 font-medium text-sm">Failed to load</p>
                  <button
                    onClick={fetchNotifications}
                    className="mt-3 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium text-sm">All clear!</p>
                  <p className="text-gray-400 text-xs mt-1">No notifications to show</p>
                </div>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-5 ${
                              !notification.read ? 'font-medium text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.message}
                            </p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(notification.createdAt)}
                              </span>
                              
                              <div className="flex items-center gap-2">
                                {!notification.read && (
                                  <button
                                    onClick={() => markAsRead(notification.id)}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  >
                                    Mark read
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                  title="Dismiss"
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

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleDismissAll}
                    className="text-xs text-gray-500 hover:text-red-600 font-medium flex items-center gap-1 ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}; 