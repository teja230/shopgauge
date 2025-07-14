# Session Extension Implementation

## Overview

This implementation provides industry-standard session management with user consent for session extension, following best practices for security and user experience.

## Key Features

### 1. **Proactive Session Extension**
- **Early Warning**: Users are notified 10 minutes before session expiration
- **Extension Prompt**: Users are prompted 5 minutes before expiration to extend their session
- **Grace Period**: 2-minute grace period after expiration before automatic logout

### 2. **User Consent & Control**
- **Clear Notifications**: Users receive clear, actionable notifications about session status
- **Extension Options**: Users can choose to extend their session or let it expire
- **Manual Logout**: Users can manually logout during grace period

### 3. **Industry Standards Compliance**
- **Security**: Sessions are only extended with explicit user consent
- **Transparency**: Clear countdown timers and status indicators
- **Graceful Degradation**: Automatic logout if user doesn't respond
- **Audit Trail**: All session events are logged for security monitoring

## Implementation Details

### Backend Components

#### 1. Session Extension Endpoint
```java
@PostMapping("/extend")
public ResponseEntity<Map<String, Object>> extendSession(
    @CookieValue(value = "shop", required = false) String shop, 
    HttpServletRequest request)
```

**Features:**
- Validates session is still active before extension
- Extends session by 4 hours from current time
- Updates Redis cache TTL
- Clears invalid session cache
- Returns detailed response with new expiration time

#### 2. Enhanced Heartbeat Endpoint
```java
@PostMapping("/heartbeat")
public ResponseEntity<Map<String, Object>> sessionHeartbeat(...)
```

**New Fields:**
- `canExtend`: Indicates if session can be extended
- `extensionAvailable`: Indicates if extension is available
- `expiresInMinutes`: Time until session expires
- `sessionExpiring`: True if session expires within 10 minutes

#### 3. ShopService Extension Method
```java
@Transactional(timeout = 5)
public boolean extendSession(String shopifyDomain, String sessionId)
```

**Features:**
- Validates session is active and not expired
- Extends expiration by 4 hours
- Updates database and Redis cache
- Comprehensive error handling and logging

### Frontend Components

#### 1. SessionManager (sessionUtils.ts)
**Enhanced Configuration:**
```typescript
interface SessionConfig {
  autoExtendEnabled: boolean; // Enable automatic session extension
  extensionPromptMinutes: number; // Minutes before expiration to prompt
  extensionGracePeriod: number; // Grace period in minutes
}
```

**New Methods:**
- `extendSession()`: Attempts to extend session via API
- `clearExtensionPrompt()`: Resets extension prompt state
- `getExtensionStatus()`: Returns current extension status

#### 2. SessionExtensionPrompt Component
**Features:**
- **Visual States**: Different colors for warning, expired, and critical states
- **Countdown Timer**: Real-time countdown display
- **Document Title**: Updates browser title with countdown in last minute
- **Action Buttons**: Extend session, dismiss, or logout options
- **Loading States**: Shows loading spinner during extension
- **Success/Error Feedback**: Clear feedback for user actions

#### 3. Event-Driven Architecture
**Custom Events:**
- `sessionExtensionPrompt`: Triggered when extension prompt should be shown
- `sessionExpired`: Triggered when session has expired
- `sessionExtended`: Triggered when session is successfully extended
- `sessionExpiring`: Triggered for general expiration warnings

## User Experience Flow

### 1. **Normal Session (No Expiration Near)**
- User works normally
- Background heartbeat continues
- No interruptions

### 2. **Session Expiring Soon (10 minutes remaining)**
- User receives warning notification
- Can dismiss or take action
- Background monitoring continues

### 3. **Extension Prompt (5 minutes remaining)**
- Modal dialog appears with countdown
- Clear options: "Extend Session" or "Dismiss"
- User must make explicit choice

### 4. **Session Expired (Grace Period)**
- Modal shows expired state with countdown
- Options: "Extend Session" or "Logout Now"
- Automatic logout after grace period

### 5. **Session Extended**
- Success notification
- Modal closes automatically
- Session continues normally

## Security Considerations

### 1. **User Consent**
- Sessions are never automatically extended
- Users must explicitly choose to extend
- Clear indication of what extension means

### 2. **Grace Period**
- 2-minute grace period prevents accidental logouts
- Users can still extend during grace period
- Automatic logout if no action taken

### 3. **Audit Trail**
- All session events are logged
- Extension attempts are tracked
- Failed extensions are logged for security review

### 4. **Session Validation**
- Backend validates session is still active before extension
- Prevents extension of already expired sessions
- Comprehensive error handling

## Configuration Options

### Backend Configuration
```properties
# Session timeout (4 hours)
spring.session.timeout=4h

# Redis cache TTL (120 minutes)
redis.cache.ttl.minutes=120

# Session inactivity hours
session.inactivity.hours=4
```

### Frontend Configuration
```typescript
const sessionConfig = {
  heartbeatInterval: 60000, // 1 minute
  expirationWarningMinutes: 10, // Show warning 10 minutes before
  extensionPromptMinutes: 5, // Show prompt 5 minutes before
  extensionGracePeriod: 2, // 2 minutes grace period
  autoExtendEnabled: true, // Enable extension functionality
};
```

## Error Handling

### 1. **Network Errors**
- Retry logic for failed extension attempts
- Clear error messages to users
- Fallback to logout if extension fails

### 2. **Session Validation Errors**
- Backend validates session state before extension
- Clear error responses for invalid sessions
- Proper HTTP status codes

### 3. **User Experience Errors**
- Graceful handling of dismissed prompts
- Clear feedback for all user actions
- No data loss during extension process

## Testing Scenarios

### 1. **Normal Extension Flow**
- User receives prompt 5 minutes before expiration
- User clicks "Extend Session"
- Session is extended successfully
- User continues working

### 2. **Grace Period Flow**
- Session expires
- User sees expired modal with countdown
- User extends session during grace period
- Session continues normally

### 3. **Automatic Logout Flow**
- Session expires
- User doesn't respond during grace period
- User is automatically logged out
- User is redirected to home page

### 4. **Manual Logout Flow**
- User clicks "Logout Now" during grace period
- User is immediately logged out
- User is redirected to home page

### 5. **Network Error Flow**
- Extension attempt fails due to network error
- User sees error message
- User can retry or logout
- Grace period continues

## Benefits

### 1. **Security**
- No automatic session extension without user consent
- Clear audit trail of all session events
- Proper validation of session state

### 2. **User Experience**
- Clear, actionable notifications
- Visual countdown timers
- Multiple extension options
- Grace period prevents accidental logouts

### 3. **Compliance**
- Follows industry standards for session management
- User consent for all session extensions
- Proper logging and audit trails
- Clear privacy and security practices

### 4. **Reliability**
- Comprehensive error handling
- Graceful degradation on failures
- No data loss during extension process
- Robust network retry logic

## Future Enhancements

### 1. **Advanced Configuration**
- User-configurable grace periods
- Custom extension durations
- Session extension limits

### 2. **Enhanced Analytics**
- Session extension analytics
- User behavior tracking
- Security event monitoring

### 3. **Mobile Optimization**
- Touch-friendly interface
- Mobile-specific notifications
- Responsive design improvements

### 4. **Integration Features**
- Integration with external SSO systems
- Custom extension workflows
- Advanced session policies

## Conclusion

This implementation provides a robust, secure, and user-friendly session management system that follows industry best practices. Users have clear control over their sessions while maintaining security and compliance requirements. 