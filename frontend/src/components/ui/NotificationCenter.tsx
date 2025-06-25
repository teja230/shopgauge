import React, { useState, useRef, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  RotateCcw,
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
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'store' | 'personal'>('all');
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
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    const matchesReadFilter = filter === 'all' || (filter === 'unread' && !n.read);
    const matchesScopeFilter = scopeFilter === 'all' || n.scope === scopeFilter;
    const result = matchesReadFilter && matchesScopeFilter;
    return result;
  });

  // Count notifications by scope
  const storeNotifications = notifications.filter(n => n.scope === 'store');
  const personalNotifications = notifications.filter(n => n.scope === 'personal');
  const unreadStoreCount = storeNotifications.filter(n => !n.read).length;
  const unreadPersonalCount = personalNotifications.filter(n => !n.read).length;

  // Handle dismiss all notifications
  const handleDismissAll = () => {
    if (window.confirm('Are you sure you want to dismiss all notifications? This action cannot be undone.')) {
      clearAll();
    }
  };

  // Format timestamp properly to fix the "about 5 hours" issue
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      // Ensure we're working with a valid date
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown time';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white hover:text-gray-200 hover:bg-white/10 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/50"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown - Fixed positioning to stick to navbar */}
      {isOpen && (
        <>
          {/* Backdrop to prevent interaction with content below */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown positioned relative to the button */}
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col" style={{ maxHeight: '80vh' }}>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchNotifications()}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded"
                    title="Refresh"
                    disabled={loading}
                  >
                    <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 text-gray-500 hover:text-gray-700 rounded"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Filter Tabs and Actions */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      filter === 'all' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All ({notifications.length})
                  </button>
                  <button
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      filter === 'unread' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Unread ({unreadCount})
                  </button>
                </div>
                
                {/* Scope Filter */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setScopeFilter('all')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      scopeFilter === 'all' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setScopeFilter('store')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      scopeFilter === 'store' 
                        ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Store{unreadStoreCount > 0 && ` (${unreadStoreCount})`}
                  </button>
                  <button
                    onClick={() => setScopeFilter('personal')}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      scopeFilter === 'personal' 
                        ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Personal{unreadPersonalCount > 0 && ` (${unreadPersonalCount})`}
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div 
              className="flex-1 overflow-y-auto notification-scroll" 
              style={{ 
                maxHeight: '400px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#d1d5db #f3f4f6'
              }}
            >
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading notifications...</p>
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                  <p className="text-red-600 font-medium">Failed to load notifications</p>
                  <p className="text-gray-500 text-sm mt-1">{error}</p>
                  <button
                    onClick={() => fetchNotifications()}
                    disabled={loading}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Retrying...' : 'Try Again'}
                  </button>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {filter === 'unread' 
                      ? 'All caught up! 🎉' 
                      : 'Notifications will appear here when you have them'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <p className={`text-sm ${
                              !notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.message}
                            </p>
                            
                            {/* Individual notification dismiss button */}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded ml-2 flex-shrink-0"
                              title="Dismiss notification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500">
                              {formatTimestamp(notification.createdAt)}
                            </p>
                            <div className="flex items-center space-x-2">
                              {/* Scope indicator - Made smaller */}
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                notification.scope === 'store' 
                                  ? 'bg-orange-100 text-orange-700' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {notification.scope === 'store' ? 'Store' : 'Personal'}
                              </span>
                              {notification.category && (
                                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {notification.category}
                                </span>
                              )}
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                  title="Mark as read"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {notification.action && (
                            <button
                              onClick={notification.action.onClick}
                              className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {notification.action.label}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Only show when there are notifications */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50">
                {/* Status info */}
                <div className="px-4 py-2 text-center">
                  <span className="text-sm text-gray-600">
                    Showing {filteredNotifications.length} of {notifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
                    {scopeFilter !== 'all' && ` (${scopeFilter})`}
                  </span>
                </div>
                
                {/* Action buttons */}
                <div className="flex justify-center space-x-3 px-4 pb-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      title="Mark all as read"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={handleDismissAll}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center space-x-1"
                    title="Dismiss all notifications"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Dismiss All</span>
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