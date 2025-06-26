# StoreSight Notifications System

A unified notification system that provides real-time feedback, persistent storage, and comprehensive user experience across the StoreSight application.

## 🎯 Overview

The StoreSight Notifications System is a comprehensive solution that combines:
- **Toast notifications** for immediate feedback
- **Persistent notifications** stored in the database
- **Browser alert/confirm capture** for system-level notifications
- **Notification Center** for historical review and management
- **Real-time updates** across all application components

## 🏗️ Architecture

### Frontend Components

#### `useNotifications` Hook
The central nervous system of the notification system, providing:
- Global state management for notifications
- Browser alert/confirm interception
- Toast creation with consistent styling
- API integration for persistent storage
- Rate limiting and error handling

**Key Features:**
- **Global State**: Shared across all components to prevent duplicate API calls
- **Browser Integration**: Captures `window.alert()` and `window.confirm()` calls
- **Rate Limiting**: 5-second minimum between API calls to prevent spam
- **Error Recovery**: Graceful fallback when backend is unavailable

#### `NotificationCenter` Component
A comprehensive UI component for notification management:
- Dropdown interface with real-time updates
- Filtering and search capabilities
- Individual and bulk actions (mark read, delete)
- Configurable positioning (top-right, top-center)
- Responsive design with smooth animations

### Backend Integration

#### Database Schema
```sql
-- Notifications table with session support
CREATE TABLE notifications (
    id VARCHAR(255) PRIMARY KEY,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    shop_id VARCHAR(255),
    session_id VARCHAR(255),
    category VARCHAR(100),
    scope VARCHAR(50) DEFAULT 'personal',
    deleted_at TIMESTAMP NULL
);
```

#### API Endpoints
- `GET /api/auth/shopify/notifications` - Fetch all notifications
- `POST /api/auth/shopify/notifications` - Create new notification
- `POST /api/auth/shopify/notifications/mark-read` - Mark as read
- `DELETE /api/auth/shopify/notifications/{id}` - Delete notification

## 🚀 Usage

### Basic Notification Types

```typescript
import { useNotifications } from '../hooks/useNotifications';

const MyComponent = () => {
  const notifications = useNotifications();

  // Success notification
  notifications.showSuccess('Operation completed successfully!');

  // Error notification
  notifications.showError('Something went wrong');

  // Warning notification
  notifications.showWarning('Please check your input');

  // Info notification
  notifications.showInfo('New feature available');
};
```

### Advanced Notification Options

```typescript
// Persistent notification (stored in database)
notifications.showSuccess('Data saved successfully', {
  persistent: true,
  category: 'Data Management',
  scope: 'store'
});

// Custom toast duration
notifications.showInfo('Temporary message', {
  duration: 2000,
  showToast: true
});

// Notification with action
notifications.showWarning('Update available', {
  action: {
    label: 'Update Now',
    onClick: () => handleUpdate()
  }
});
```

### Store vs Personal Notifications

```typescript
// Store-wide notifications (visible to all users of the shop)
notifications.showStoreSuccess('Shop settings updated');
notifications.showStoreError('API connection lost');

// Personal notifications (only visible to current user)
notifications.showPersonalNotification('Profile updated', 'success');
```

### Browser Alert Integration

The system automatically captures browser alerts and confirmations:

```typescript
// These will automatically appear in the NotificationCenter
window.alert('This will be captured as a System notification');
window.confirm('This will also be captured');
```

## 🎨 Styling & Theming

### Toast Styling
Toasts use a consistent dark theme with color-coded variants:
- **Success**: Green background (#059669)
- **Error**: Red background (#dc2626)
- **Warning**: Orange background (#d97706)
- **Info**: Blue background (#2563eb)

### Notification Center Styling
- Modern card-based design with gradient headers
- Smooth hover effects and transitions
- Color-coded borders for unread notifications
- Responsive layout with proper scrolling

## 🔧 Configuration

### Notification Center Position
```typescript
// Top-right (default)
<NotificationCenter position="top-right" />

// Top-center
<NotificationCenter position="top-center" />
```

### Rate Limiting
```typescript
// Configured in useNotifications.ts
const RATE_LIMIT_MS = 5000; // 5 seconds between API calls
```

### Global State Management
The system uses global variables to prevent duplicate API calls:
```typescript
let globalNotifications: Notification[] = [];
let globalUnreadCount = 0;
let isLoadingGlobal = false;
let lastFetchTime = 0;
```

## 🐛 Troubleshooting

### Common Issues

#### Notifications Not Appearing
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Ensure `useNotifications` hook is properly imported
4. Check rate limiting (5-second minimum between calls)

#### System Notifications Missing
- Ensure the hook is mounted in a component that stays active
- Browser alerts/confirms are captured automatically
- Check that cleanup functions aren't restoring original window methods

#### Performance Issues
- Rate limiting prevents excessive API calls
- Global state prevents duplicate fetches
- Notifications are limited to 50 per session

### Debug Mode
Enable detailed logging by checking browser console:
```typescript
// Logs are automatically generated for:
// - API call attempts
// - Rate limiting events
// - Error conditions
// - State updates
```

## 🔄 Integration Points

### Existing Components
The notification system is integrated into:
- `DashboardPage` - Revenue alerts, connection errors
- `CompetitorsPage` - Scraping results, API errors
- `ProfilePage` - Settings updates, validation errors
- `AdminPage` - System-wide notifications
- `SuggestionDrawer` - Competitor suggestions
- `NavBar` - Notification center access

### Error Boundaries
The system works with React Error Boundaries to provide consistent error reporting across the application.

## 📊 Monitoring & Analytics

### Metrics Tracked
- Notification creation rates
- Read/unread ratios
- User interaction patterns
- System vs user-generated notifications
- Error rates and recovery times

### Performance Considerations
- Lazy loading of notification history
- Efficient state updates
- Minimal re-renders through proper memoization
- Optimized API calls with caching

## 🔮 Future Enhancements

### Planned Features
- **Push Notifications**: Browser push notifications for critical alerts
- **Email Integration**: Email notifications for important events
- **Notification Templates**: Predefined notification patterns
- **Advanced Filtering**: Date ranges, categories, scopes
- **Bulk Operations**: Enhanced bulk management capabilities
- **Real-time Updates**: WebSocket integration for live notifications

### Customization Options
- **Theme Integration**: Custom color schemes
- **Sound Alerts**: Audio notifications for critical events
- **Desktop Notifications**: Native OS notifications
- **Mobile Optimization**: Enhanced mobile experience

## 📝 API Reference

### Notification Interface
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
  scope?: 'store' | 'personal';
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Hook Return Value
```typescript
{
  // State
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  addNotification: (message, type, options) => string;
  showSuccess: (message, options?) => string;
  showError: (message, options?) => string;
  showWarning: (message, options?) => string;
  showInfo: (message, options?) => string;

  // Management
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}
```

## 🤝 Contributing

When contributing to the notifications system:

1. **Follow the existing patterns** for notification creation
2. **Test browser integration** with alerts and confirms
3. **Verify rate limiting** doesn't break functionality
4. **Update documentation** for new features
5. **Consider performance impact** of new features

## 📄 License

This notification system is part of the StoreSight application and follows the same licensing terms as the main project. 