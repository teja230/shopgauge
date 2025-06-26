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

# Notification System Documentation

## Overview
The NotificationCenter component provides a unified notification system that integrates seamlessly with the site's Material-UI theme and design system.

## Theme Integration

### Design System Compliance
- **Material-UI Integration**: Fully styled using Material-UI components and theme
- **Color Palette**: Uses theme colors (`primary`, `error`, `warning`, `success`)
- **Typography**: Follows site's Inter font family and typography hierarchy
- **Spacing**: Uses theme spacing system for consistency
- **Shadows**: Matches site's elevation and shadow patterns
- **Border Radius**: 12px consistent with site's card styling

### Styled Components
- `NotificationDropdown`: Main container with proper Material-UI Paper styling
- `NotificationHeader`: Sticky header with theme-consistent styling
- `NotificationContent`: Scrollable content area with custom scrollbar styling
- `NotificationItem`: Individual notification with hover states and unread indicators
- `NotificationActions`: Footer actions with proper spacing and theming
- `BellButton`: Notification bell icon with Material-UI IconButton styling
- `StyledDialog`: Confirmation dialogs with enhanced Material-UI styling

## Key Features

### Visual Hierarchy
- **Unread Notifications**: Highlighted with `theme.palette.action.hover` background
- **Category Chips**: Color-coded with primary theme colors
- **Type Icons**: Uses theme-appropriate colors for success, error, warning, info
- **Interactive Elements**: Proper hover states and focus indicators

### Responsive Design
- Uses Material-UI's `useMediaQuery` for responsive breakpoints
- Smaller width (320px) on mobile devices
- Proper touch target sizes for mobile interaction

### Accessibility
- Proper ARIA labels and descriptions
- Tooltip support for all interactive elements
- Keyboard navigation support
- Screen reader friendly structure

## Components Used

### Material-UI Components
- `Box`, `Paper`, `Typography` for layout and text
- `IconButton`, `Button` for interactions
- `Badge` for unread count display
- `Tabs`, `Tab` for filtering interface
- `CircularProgress` for loading states
- `Dialog`, `Alert` for confirmations and errors
- `Tooltip`, `Fade` for enhanced UX

### Custom Styling
- Styled components using `styled()` from Material-UI
- Theme-aware color schemes
- Consistent spacing and typography
- Custom scrollbar styling that matches the theme

## Integration Points

### Toast Integration
- Works seamlessly with react-hot-toast
- Theme-consistent colors and styling
- Proper timing and positioning

### Database Integration
- Persistent notifications stored in backend
- Session-based notification management
- Real-time updates and synchronization

### Error Handling
- Graceful error states with Material-UI Alert components
- Rate limiting and retry mechanisms
- User-friendly error messages

## Usage Examples

```tsx
// Basic usage with theme integration
<NotificationCenter onNotificationCountChange={(count) => console.log(count)} />

// The component automatically uses the site's theme
// No additional styling or configuration needed
```

## Theme Customization

The NotificationCenter automatically inherits all theme customizations:
- Color changes in `theme.ts` are automatically applied
- Typography changes are reflected in all text
- Spacing and border radius follow theme configuration
- Dark mode support (if theme supports it)

## Performance Optimizations

- Uses Material-UI's `useMediaQuery` for efficient responsive queries
- Styled components are memoized for performance
- Efficient re-rendering with proper React patterns
- Optimized scrolling with custom scrollbar styling

This integration ensures the NotificationCenter feels like a natural part of the application's design system while maintaining excellent functionality and user experience. 