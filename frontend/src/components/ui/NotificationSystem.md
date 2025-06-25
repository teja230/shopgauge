# Unified Notification System

## Overview

The StoreGauge application now features a comprehensive, unified notification system that combines both **persistent** and **transient** notifications in a modern, user-friendly interface.

## Key Features

### ✅ **Unified Architecture**
- **Single Hook**: `useNotifications()` manages all notification types
- **Dual Display**: Toast notifications + Notification center
- **Smart Persistence**: Choose between temporary and database-stored notifications
- **Type Safety**: Full TypeScript support with proper interfaces

### 🎯 **User Experience**
- **Top-Right Position**: Industry-standard placement in navigation bar
- **Dismissible**: Users can close/delete notifications individually or all at once
- **Visual Hierarchy**: Unread notifications are highlighted and badged
- **Action Support**: Notifications can include interactive buttons
- **Category Organization**: Notifications grouped by type (Authentication, Connection, etc.)

### 🔧 **Developer Experience**
- **Simple API**: Consistent interface for all notification types
- **Automatic Persistence**: Backend integration for important notifications
- **Flexible Options**: Customizable duration, categories, and actions
- **Error Handling**: Graceful fallbacks and error states

## Quick Start

### 1. Import the Hook

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const notifications = useNotifications();
  
  // Your component logic
}
```

### 2. Show Notifications

```typescript
// Simple success notification (toast only)
notifications.showSuccess('Operation completed!');

// Persistent error notification (saved to database)
notifications.showError('Connection failed', {
  persistent: true,
  category: 'Connection',
  action: {
    label: 'Retry',
    onClick: () => retryConnection()
  }
});

// Warning with custom duration
notifications.showWarning('Rate limit approaching', {
  duration: 10000, // 10 seconds
  category: 'API'
});

// Info notification
notifications.showInfo('New feature available', {
  persistent: true,
  category: 'Updates',
  action: {
    label: 'Learn More',
    onClick: () => navigate('/features')
  }
});
```

## API Reference

### useNotifications()

Returns an object with the following methods and state:

#### State
- `notifications: Notification[]` - Array of all notifications
- `unreadCount: number` - Count of unread notifications  
- `loading: boolean` - Loading state for API calls

#### Notification Methods
- `showSuccess(message, options?)` - Green success notification
- `showError(message, options?)` - Red error notification  
- `showWarning(message, options?)` - Yellow warning notification
- `showInfo(message, options?)` - Blue info notification
- `addNotification(message, type, options?)` - Generic notification method

#### Management Methods
- `markAsRead(id)` - Mark single notification as read
- `markAllAsRead()` - Mark all notifications as read
- `deleteNotification(id)` - Remove notification
- `clearAll()` - Clear all notifications and toasts
- `fetchNotifications()` - Refresh from backend
- `cleanup()` - Clean up timers and resources

#### Legacy Support
- `showSessionExpired(options?)` - Enhanced session expiry notification
- `showConnectionError()` - Network connection error

### Notification Options

```typescript
interface NotificationOptions {
  persistent?: boolean;     // Save to database (default: false)
  showToast?: boolean;     // Show toast popup (default: true)
  duration?: number;       // Toast duration in ms
  category?: string;       // Notification category
  action?: {              // Interactive action button
    label: string;
    onClick: () => void;
  };
}
```

### Notification Object

```typescript
interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: string;
  shop: string;
  category?: string;
  persistent?: boolean;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

## Integration Guide

### 1. Navigation Bar Integration

The notification center is automatically integrated into the navigation bar for authenticated users:

```typescript
// In NavBar.tsx
<NotificationCenter 
  onNotificationCountChange={(count) => setNotificationCount(count)}
/>
```

### 2. Replacing Legacy Toast Calls

**Before:**
```typescript
import toast from 'react-hot-toast';

toast.success('Operation successful!');
toast.error('Something went wrong');
```

**After:**
```typescript
import { useNotifications } from '../hooks/useNotifications';

const notifications = useNotifications();

notifications.showSuccess('Operation successful!');
notifications.showError('Something went wrong', { persistent: true });
```

### 3. Session Management

Enhanced session expiry notifications with persistence:

```typescript
// Replaces useSessionNotification
notifications.showSessionExpired({
  redirect: true,
  redirectDelay: 5000,
  showToast: true
});
```

## Best Practices

### 🎯 **When to Use Persistent Notifications**

**Use persistent notifications for:**
- ✅ Authentication events (login, logout, session expiry)
- ✅ Critical errors that need user attention
- ✅ Important system updates or maintenance notices
- ✅ Data processing completion (exports, imports)
- ✅ Security-related events

**Use transient notifications for:**
- ✅ Form validation feedback
- ✅ Quick success confirmations
- ✅ Temporary status updates
- ✅ Non-critical warnings

### 📱 **Categories**

Organize notifications with consistent categories:
- `Authentication` - Login, logout, session events
- `Connection` - Network, API, service connectivity
- `Data` - Processing, exports, imports
- `Security` - Security-related events
- `Updates` - Feature updates, announcements
- `Operations` - User actions, form submissions

### ⚡ **Performance**

- Persistent notifications are automatically cached
- Toast notifications are automatically deduped by ID
- The system handles cleanup and memory management
- Network requests are batched and optimized

## Styling & Customization

### Toast Styling

The system uses consistent styling across all notification types:

```typescript
const toastConfig = {
  success: { background: '#10b981', color: '#ffffff' },
  error: { background: '#ef4444', color: '#ffffff' },
  warning: { background: '#f59e0b', color: '#ffffff' },
  info: { background: '#3b82f6', color: '#ffffff' }
};
```

### Notification Center Styling

Uses Tailwind CSS with consistent theme colors and proper responsive design.

## Migration Guide

### From useSessionNotification

```typescript
// Old
import { useSessionNotification } from '../hooks/useSessionNotification';
const { showSessionExpired, showConnectionError } = useSessionNotification();

// New  
import { useNotifications } from '../hooks/useNotifications';
const notifications = useNotifications();
// Methods remain the same: showSessionExpired, showConnectionError
```

### From Direct Toast Usage

```typescript
// Old
import toast from 'react-hot-toast';
toast.success('Success!');

// New
import { useNotifications } from '../hooks/useNotifications';
const notifications = useNotifications();
notifications.showSuccess('Success!');
```

## Backend Integration

The system integrates with these backend endpoints:

- `GET /api/auth/shopify/notifications` - Fetch notifications
- `POST /api/auth/shopify/notifications` - Create notification
- `POST /api/auth/shopify/notifications/mark-read` - Mark as read

## Future Enhancements

Planned improvements include:
- 🔔 Push notification support
- 📧 Email notification preferences
- 🎛️ User notification settings page
- 📊 Notification analytics
- 🌐 Real-time notifications via WebSocket
- 🔄 Notification templates and batching

---

## Support

For questions or issues with the notification system, please refer to the main project documentation or create an issue in the repository. 