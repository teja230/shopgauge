# Comprehensive Notification System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Session-Based Notifications](#session-based-notifications)
4. [Global Settings Context](#global-settings-context)
5. [Frontend Implementation](#frontend-implementation)
6. [Backend Implementation](#backend-implementation)
7. [API Reference](#api-reference)
8. [Integration Guide](#integration-guide)
9. [Best Practices](#best-practices)
10. [Migration Guide](#migration-guide)
11. [Monitoring & Analytics](#monitoring--analytics)
12. [Future Enhancements](#future-enhancements)

## Overview

The StoreGauge application features a comprehensive, unified notification system that combines **persistent** and **transient** notifications with **session-based privacy** and **global settings management**. This system provides a modern, user-friendly interface that respects user preferences and maintains data privacy in multi-session environments.

### Key Features

#### ✅ **Unified Architecture**
- **Single Hook**: `useNotifications()` manages all notification types
- **Dual Display**: Toast notifications + Notification center
- **Smart Persistence**: Choose between temporary and database-stored notifications
- **Type Safety**: Full TypeScript support with proper interfaces
- **Session Isolation**: Private notifications per user session
- **Global Settings**: Consistent behavior across all components

#### 🎯 **User Experience**
- **Top-Right Position**: Industry-standard placement in navigation bar
- **Dismissible**: Users can close/delete notifications individually or all at once
- **Visual Hierarchy**: Unread notifications are highlighted and badged
- **Action Support**: Notifications can include interactive buttons
- **Category Organization**: Notifications grouped by type (Authentication, Connection, etc.)
- **Settings Control**: Users can configure notification preferences globally

#### 🔧 **Developer Experience**
- **Simple API**: Consistent interface for all notification types
- **Automatic Persistence**: Backend integration for important notifications
- **Flexible Options**: Customizable duration, categories, and actions
- **Error Handling**: Graceful fallbacks and error states
- **Session Context**: Automatic session management for privacy

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Notification System                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend Components                                        │
│  ├── NotificationCenter (UI Component)                     │
│  ├── useNotifications (Hook)                               │
│  ├── NotificationSettingsContext (Global State)           │
│  └── Toast Integration (react-hot-toast)                  │
├─────────────────────────────────────────────────────────────┤
│  Backend Services                                           │
│  ├── NotificationService (Business Logic)                  │
│  ├── NotificationRepository (Data Access)                  │
│  └── Database (PostgreSQL)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Component calls `useNotifications()`
2. **Hook Processing** → Checks global settings and session context
3. **Toast Display** → Shows immediate feedback (if enabled)
4. **Persistence** → Saves to database (if persistent)
5. **UI Update** → Updates notification center
6. **Cross-Component Sync** → All components reflect changes

## Session-Based Notifications

### Problem Solved

**Before**: All notifications for a shop were shared across all sessions
- User A and User B logging into the same shop would see each other's notifications
- No privacy between different browser sessions or devices
- Confusing user experience with mixed notifications

**After**: Each session has its own notifications + shop-wide notifications
- Each user session sees only their own notifications
- Shop-wide notifications (like system alerts) are visible to all sessions
- Better privacy and cleaner user experience

### Database Schema

```sql
-- Enhanced notifications table
CREATE TABLE notifications (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NULL,  -- NULL = shop-wide notification
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,     -- success, error, warning, info
  category VARCHAR(100) NULL,    -- Authentication, Connection, etc.
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  scope VARCHAR(50) DEFAULT 'personal', -- 'store' | 'personal'
  action_label VARCHAR(255) NULL,
  action_url VARCHAR(500) NULL
);

-- Indexes for performance
CREATE INDEX idx_notifications_session_id ON notifications(session_id);
CREATE INDEX idx_notifications_shop_session ON notifications(shop, session_id);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_scope ON notifications(scope);
```

### Notification Types

1. **Session-Specific Notifications** (`session_id` = actual session ID)
   - Form validation errors
   - User-specific actions (profile updates, exports)
   - Authentication status for that session
   - Personal settings changes

2. **Shop-Wide Notifications** (`session_id` = NULL)
   - System maintenance alerts
   - Shop configuration changes
   - Critical security alerts
   - Service announcements

## Global Settings Context

### Problem Solved
- **Before**: Each component read notification settings independently from localStorage
- **Issue**: Settings changes in NotificationCenter didn't affect other components
- **Result**: "Show Notifications" setting wasn't working consistently across the app

### Solution Architecture

```typescript
// New Context Provider
<NotificationSettingsProvider>
  <AppContent />
</NotificationSettingsProvider>

// Global Settings Interface
interface NotificationSettings {
  showToasts: boolean;
  soundEnabled: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  marketingNotifications: boolean;
}
```

### Key Features
- **Single Source of Truth**: All components share the same settings state
- **Reactive Updates**: Settings changes immediately affect all components
- **Persistent Storage**: Settings saved to localStorage automatically
- **Type Safety**: Full TypeScript support with proper interfaces
- **Backward Compatibility**: Existing components work without changes

### Implementation Details

```typescript
// Context Hook
const { settings, updateSetting } = useNotificationSettings();

// Automatic Integration
const useNotifications = (options?: UseNotificationsOptions) => {
  const { settings: contextSettings } = useNotificationSettings();
  
  // Uses context settings if no options provided
  const notificationSettings = options?.notificationSettings || contextSettings;
  
  // All notifications now respect global settings
  const shouldShowToast = showToast && notificationSettings.showToasts;
};
```

### Benefits
- ✅ **Consistent Behavior**: All notifications respect user settings
- ✅ **Real-time Updates**: Settings changes apply immediately
- ✅ **Better UX**: Users have full control over notification preferences
- ✅ **Developer Friendly**: Simple API with automatic integration
- ✅ **Performance**: Efficient state management with React Context

## Frontend Implementation

### Quick Start

#### 1. Import the Hook

```typescript
import { useNotifications } from '../hooks/useNotifications';

function MyComponent() {
  const notifications = useNotifications();
  
  // Your component logic
}
```

#### 2. Show Notifications

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

### Notification Hook Usage

```typescript
// The useNotifications hook automatically handles session context
const { notifications, unreadCount, showSuccess, showError } = useNotifications();

// Session-specific notifications (default behavior)
notifications.showSuccess("Profile updated successfully", {
  persistent: true,
  category: "Profile"
});

// These automatically go to the current user's session
notifications.showError("Invalid input", {
  category: "Validation"
});
```

### Notification Center Display

The NotificationCenter component shows:
- **Session-specific notifications**: Only for current user
- **Shop-wide notifications**: Visible to all users of the shop
- **Category organization**: Better grouping and filtering
- **Session context**: Clear indication of notification scope
- **Settings management**: User-configurable notification preferences

### Theme Integration

#### Design System Compliance
- **Material-UI Integration**: Fully styled using Material-UI components and theme
- **Color Palette**: Uses theme colors (`primary`, `error`, `warning`, `success`)
- **Typography**: Follows site's Inter font family and typography hierarchy
- **Spacing**: Uses theme spacing system for consistency
- **Shadows**: Matches site's elevation and shadow patterns
- **Border Radius**: 12px consistent with site's card styling

#### Styled Components
- `NotificationDropdown`: Main container with proper Material-UI Paper styling
- `NotificationHeader`: Sticky header with theme-consistent styling
- `NotificationContent`: Scrollable content area with custom scrollbar styling
- `NotificationItem`: Individual notification with hover states and unread indicators
- `NotificationActions`: Footer actions with proper spacing and theming
- `BellButton`: Notification bell icon with Material-UI IconButton styling
- `StyledDialog`: Confirmation dialogs with enhanced Material-UI styling

## Backend Implementation

### NotificationService Methods

```java
// Create session-specific notification
createNotification(shop, sessionId, message, type, category)

// Create shop-wide notification (visible to all sessions)
createNotification(shop, message, type, category)

// Get notifications for a session (includes shop-wide)
getNotifications(shop, sessionId)

// Count unread notifications for a session
getUnreadCount(shop, sessionId)

// Mark notification as read (with session validation)
markAsRead(shop, notificationId, sessionId)
```

### Repository Queries

```java
// Get session + shop-wide notifications
findByShopAndSessionOrderByCreatedAtDesc(shop, sessionId)

// Count unread for session
countUnreadBySession(shop, sessionId)

// Find by category for session
findByShopAndSessionAndCategory(shop, sessionId, category)

// Get shop-wide notifications only
findByShopAndSessionIsNull(shop)
```

### Database Migration

```sql
-- V17__add_session_support_to_notifications.sql
ALTER TABLE notifications ADD COLUMN session_id VARCHAR(255);
ALTER TABLE notifications ADD COLUMN category VARCHAR(100);

-- V18__add_soft_delete_to_notifications.sql
ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP NULL;

-- V19__add_scope_to_notifications.sql
ALTER TABLE notifications ADD COLUMN scope VARCHAR(50) DEFAULT 'personal';

-- Existing notifications become shop-wide
UPDATE notifications SET session_id = NULL WHERE session_id IS NULL;
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
- `markAsUnread(id)` - Mark single notification as unread
- `markAllAsRead()` - Mark all notifications as read
- `markAllAsUnread()` - Mark all notifications as unread
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
  scope?: 'store' | 'personal'; // Notification scope
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
  scope?: 'store' | 'personal';
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### useNotificationSettings()

Returns an object with the following methods and state:

#### State
- `settings: NotificationSettings` - Current notification settings

#### Methods
- `updateSetting(key, value)` - Update a single setting
- `updateSettings(newSettings)` - Update multiple settings

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

### 4. Settings Management

```typescript
// Access settings in any component
const { settings, updateSetting } = useNotificationSettings();

// Update settings
updateSetting('showToasts', false); // Disables all toasts immediately

// Check settings
if (settings.soundEnabled) {
  // Play notification sound
}
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
- `System` - System maintenance, alerts
- `Profile` - User profile changes
- `Validation` - Form validation errors

### ⚡ **Performance**

- Persistent notifications are automatically cached
- Toast notifications are automatically deduped by ID
- The system handles cleanup and memory management
- Network requests are batched and optimized
- Session-based queries improve performance

### 🔒 **Privacy & Security**

#### Session Isolation
- Users cannot see notifications from other sessions
- Notifications are tied to specific browser sessions
- Session validation prevents cross-session access

#### Data Protection
- Sensitive user actions (exports, profile changes) are session-private
- System-wide alerts remain visible to all authorized users
- Automatic cleanup when sessions expire

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

### Backward Compatibility
- Existing notifications become shop-wide (session_id = NULL)
- Legacy API endpoints continue to work
- Gradual migration to session-aware endpoints

## Monitoring & Analytics

### Session Metrics
- Track notification engagement per session
- Monitor session-specific notification patterns
- Analyze user behavior across different sessions

### Performance Monitoring
- Query performance with session-based indexes
- Notification delivery success rates
- Session cleanup efficiency

### Settings Analytics
- Track user notification preferences
- Monitor settings adoption rates
- Analyze notification engagement by setting

## Backend Integration

The system integrates with these backend endpoints:

- `GET /api/auth/shopify/notifications` - Fetch notifications
- `POST /api/auth/shopify/notifications` - Create notification
- `POST /api/auth/shopify/notifications/mark-read` - Mark as read
- `DELETE /api/auth/shopify/notifications/{id}` - Delete notification

## Future Enhancements

Planned improvements include:
- 🔔 Push notification support
- 📧 Email notification preferences
- 🎛️ User notification settings page
- 📊 Notification analytics
- 🌐 Real-time notifications via WebSocket
- 🔄 Notification templates and batching
- 📱 Mobile app notifications
- 🎨 Advanced notification themes
- 🔍 Advanced filtering and search
- 📈 Notification performance metrics

## Support

For questions or issues with the notification system, please refer to the main project documentation or create an issue in the repository.

---

*This comprehensive documentation consolidates all notification system information into a single source of truth, covering session-based notifications, global settings context, frontend implementation, backend integration, and best practices.* 