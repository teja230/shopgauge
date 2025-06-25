# Session-Based Notifications System

## Overview

The notification system has been enhanced to support **session-based notifications**, providing better privacy and user experience in multi-session environments.

## Problem Solved

**Before**: All notifications for a shop were shared across all sessions
- User A and User B logging into the same shop would see each other's notifications
- No privacy between different browser sessions or devices
- Confusing user experience with mixed notifications

**After**: Each session has its own notifications + shop-wide notifications
- Each user session sees only their own notifications
- Shop-wide notifications (like system alerts) are visible to all sessions
- Better privacy and cleaner user experience

## Architecture

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
  created_at TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_notifications_session_id ON notifications(session_id);
CREATE INDEX idx_notifications_shop_session ON notifications(shop, session_id);
CREATE INDEX idx_notifications_category ON notifications(category);
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
countUnreadByShopAndSession(shop, sessionId)

// Find by category for session
findByShopAndSessionAndCategory(shop, sessionId, category)
```

## Frontend Integration

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

The NotificationCenter component now shows:
- **Session-specific notifications**: Only for current user
- **Shop-wide notifications**: Visible to all users of the shop
- **Category organization**: Better grouping and filtering
- **Session context**: Clear indication of notification scope

## Privacy & Security

### Session Isolation
- Users cannot see notifications from other sessions
- Notifications are tied to specific browser sessions
- Session validation prevents cross-session access

### Data Protection
- Sensitive user actions (exports, profile changes) are session-private
- System-wide alerts remain visible to all authorized users
- Automatic cleanup when sessions expire

## Migration Strategy

### Backward Compatibility
- Existing notifications become shop-wide (session_id = NULL)
- Legacy API endpoints continue to work
- Gradual migration to session-aware endpoints

### Database Migration
```sql
-- V17__add_session_support_to_notifications.sql
ALTER TABLE notifications ADD COLUMN session_id VARCHAR(255);
ALTER TABLE notifications ADD COLUMN category VARCHAR(100);

-- Existing notifications become shop-wide
UPDATE notifications SET session_id = NULL WHERE session_id IS NULL;
```

## Benefits

### For Users
- **Privacy**: Personal notifications stay private
- **Clarity**: Only relevant notifications are shown
- **Context**: Better organization with categories
- **Performance**: Faster loading with session-specific queries

### For Developers
- **Scalability**: Better performance with indexed queries
- **Flexibility**: Easy to create shop-wide vs session-specific notifications
- **Debugging**: Clear session context for troubleshooting
- **Maintenance**: Automatic cleanup of session-specific data

## Usage Examples

### Session-Specific Notifications
```typescript
// User profile actions
notifications.showSuccess("Export completed", {
  persistent: true,
  category: "Data Export",
  action: {
    label: "Download",
    onClick: () => downloadFile()
  }
});

// Form validation
notifications.showError("Please fill all required fields", {
  category: "Validation"
});

// Authentication events
notifications.showInfo("Session refreshed", {
  persistent: true,
  category: "Authentication"
});
```

### Shop-Wide Notifications (Backend)
```java
// System alerts (visible to all sessions)
notificationService.createNotification(
  shop, 
  "System maintenance scheduled for tonight", 
  "warning", 
  "System"
);

// Security alerts
notificationService.createNotification(
  shop,
  "New login detected from unusual location",
  "warning",
  "Security"
);
```

## Monitoring & Analytics

### Session Metrics
- Track notification engagement per session
- Monitor session-specific notification patterns
- Analyze user behavior across different sessions

### Performance Monitoring
- Query performance with session-based indexes
- Notification delivery success rates
- Session cleanup efficiency

## Future Enhancements

1. **Real-time Updates**: WebSocket support for instant notification delivery
2. **Push Notifications**: Browser push notifications for critical alerts
3. **Notification Preferences**: User-configurable notification settings
4. **Advanced Filtering**: More sophisticated category and priority systems
5. **Analytics Dashboard**: Detailed notification metrics and insights

This session-based notification system provides a foundation for scalable, private, and user-friendly notifications in multi-user environments. 