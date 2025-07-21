# Admin Session Invalidation Implementation

## 📋 Executive Summary

This document describes the implementation of a comprehensive admin session invalidation system that allows administrators to properly invalidate shop sessions with real-time notifications to affected users.

## 🎯 **Problem Solved**

**Previous Issue**: 
- `broadcastToAllShops()` only sent notifications but didn't actually invalidate sessions
- No proper session invalidation mechanism for admin logout scenarios
- Users remained logged in even when sessions were "invalidated"

**New Solution**:
- ✅ **Proper session invalidation** with database and Redis cleanup
- ✅ **Real-time notifications** to affected users
- ✅ **Pre-invalidation warnings** to give users time to save work
- ✅ **Post-invalidation notifications** with re-authentication prompts
- ✅ **Audit logging** for security compliance

## 🏗️ **Architecture Overview**

### **Components**

1. **`AdminSessionInvalidationService`** - Core service for session invalidation
2. **`AdminAuthController`** - New admin endpoints for session management
3. **`SseService`** - Enhanced with proper notification system
4. **Frontend SSE Handler** - Updated to handle new invalidation events

### **Flow Diagram**

```
Admin Action → AdminAuthController → AdminSessionInvalidationService → 
ShopService.forceInvalidateSession() → SseService.notifications → Frontend
```

## 🔧 **Backend Implementation**

### **1. AdminSessionInvalidationService**

**Location**: `backend/src/main/java/com/storesight/backend/service/AdminSessionInvalidationService.java`

**Key Methods**:

#### **`invalidateAllSessionsForShop()`**
```java
public Map<String, Object> invalidateAllSessionsForShop(
    String shopDomain, String adminUsername, String reason, String clientIp)
```

**Process**:
1. **Get active sessions** for the shop
2. **Send pre-invalidation notification** to all users
3. **Force invalidate** each session using `ShopService.forceInvalidateSession()`
4. **Force close SSE connections** for the shop
5. **Send post-invalidation notification** to all users
6. **Log audit event** for security compliance

#### **`invalidateSpecificSession()`**
```java
public Map<String, Object> invalidateSpecificSession(
    String shopDomain, String sessionId, String adminUsername, String reason, String clientIp)
```

**Process**:
1. **Validate session** exists and belongs to shop
2. **Send pre-invalidation notification** to specific user
3. **Force invalidate** the specific session
4. **Force close SSE connections** for the shop
5. **Send post-invalidation notification** to the user
6. **Log audit event** for security compliance

### **2. AdminAuthController Endpoints**

**Location**: `backend/src/main/java/com/storesight/backend/controller/AdminAuthController.java`

#### **New Endpoints**:

**Invalidate All Sessions for a Shop**:
```
POST /api/admin/invalidate-shop-sessions/{shopDomain}
Body: { "reason": "Optional reason for invalidation" }
```

**Invalidate Specific Session**:
```
POST /api/admin/invalidate-session/{shopDomain}/{sessionId}
Body: { "reason": "Optional reason for invalidation" }
```

**Get Shops with Active Sessions**:
```
GET /api/admin/shops-with-sessions
```

### **3. Enhanced SseService Notifications**

**New Event Types**:

#### **`session_pre_invalidation`**
- **Purpose**: Warn users that their session will be invalidated
- **Payload**: `{ adminUsername, reason, timestamp, type: "pre_invalidation" }`
- **Duration**: 5 seconds before actual invalidation

#### **`session_invalidated`**
- **Purpose**: Notify users that their session has been invalidated
- **Payload**: `{ adminUsername, invalidatedCount, timestamp, type: "post_invalidation" }`
- **Duration**: 10 seconds with re-authentication prompt

## 🎨 **Frontend Implementation**

### **1. Enhanced SSE Event Handling**

**Location**: `frontend/src/hooks/useEnterpriseSse.ts`

#### **New Event Handlers**:

```typescript
case 'session_pre_invalidation':
  const adminUsername = sseEvent.data?.adminUsername || 'an administrator';
  const reason = sseEvent.data?.reason || 'Admin action';
  addNotification(
    `${adminUsername} is about to invalidate your session. Reason: ${reason}`,
    'warning',
    {
      duration: 8000,
      category: 'Session Security',
      persistent: true
    }
  );
  break;

case 'session_invalidated':
  const adminUsername = sseEvent.data?.adminUsername || 'an administrator';
  addNotification(
    `Your session has been invalidated by ${adminUsername}. Please re-authenticate.`,
    'error',
    {
      duration: 0, // Persistent until user action
      category: 'Session Security',
      persistent: true,
      action: {
        label: 'Re-authenticate',
        onClick: () => window.location.href = '/'
      }
    }
  );
  
  // Force logout after 2 seconds
  setTimeout(() => {
    console.log('Session invalidated by admin - forcing logout');
    handleSessionLogout();
  }, 2000);
  break;
```

### **2. New Admin API Functions**

**Location**: `frontend/src/api/admin.ts`

#### **`invalidateShopSessions()`**
```typescript
export const invalidateShopSessions = async (shopDomain: string, reason?: string): Promise<any>
```

#### **`invalidateSpecificSession()`**
```typescript
export const invalidateSpecificSession = async (shopDomain: string, sessionId: string, reason?: string): Promise<any>
```

#### **`getShopsWithSessions()`**
```typescript
export const getShopsWithSessions = async (): Promise<any>
```

## 🔄 **Session Invalidation Process**

### **Step-by-Step Flow**

1. **Admin Initiates Invalidation**
   ```
   Admin → POST /api/admin/invalidate-shop-sessions/{shopDomain}
   ```

2. **Pre-Invalidation Notification**
   ```
   Backend → SSE → Frontend: "session_pre_invalidation"
   Frontend → User: Warning notification (8 seconds)
   ```

3. **Session Invalidation**
   ```
   Backend → ShopService.forceInvalidateSession()
   Backend → Database: Set is_active = false
   Backend → Redis: Clear session tokens
   Backend → SSE: Force close connections
   ```

4. **Post-Invalidation Notification**
   ```
   Backend → SSE → Frontend: "session_invalidated"
   Frontend → User: Error notification with re-auth button
   Frontend → Auto-logout after 2 seconds
   ```

5. **Audit Logging**
   ```
   Backend → AdminAuthService.logAuditEvent()
   ```

## 🛡️ **Security Features**

### **1. Authentication & Authorization**
- All endpoints require valid admin JWT token
- Token validation on every request
- IP address logging for audit trails

### **2. Session Validation**
- Verify session exists before invalidation
- Check session belongs to correct shop
- Prevent duplicate invalidations

### **3. Audit Logging**
- All invalidation actions logged
- Include admin username, reason, and timestamp
- IP address tracking for security

### **4. Error Handling**
- Graceful degradation if SSE fails
- Continue invalidation even if notifications fail
- Detailed error logging

## 📊 **Usage Examples**

### **1. Invalidate All Sessions for a Shop**

**Backend**:
```java
Map<String, Object> result = adminSessionInvalidationService.invalidateAllSessionsForShop(
    "mystore.myshopify.com", 
    "admin_user", 
    "Security maintenance", 
    "192.168.1.100"
);
```

**Frontend**:
```typescript
const result = await invalidateShopSessions("mystore.myshopify.com", "Security maintenance");
if (result.success) {
  console.log(`Invalidated ${result.invalidatedSessions} sessions`);
}
```

### **2. Invalidate Specific Session**

**Backend**:
```java
Map<String, Object> result = adminSessionInvalidationService.invalidateSpecificSession(
    "mystore.myshopify.com", 
    "session-123", 
    "admin_user", 
    "Suspicious activity", 
    "192.168.1.100"
);
```

**Frontend**:
```typescript
const result = await invalidateSpecificSession(
  "mystore.myshopify.com", 
  "session-123", 
  "Suspicious activity"
);
```

## 🔍 **Monitoring & Debugging**

### **1. Log Messages**

**Pre-invalidation**:
```
Admin admin_user initiating session invalidation for shop: mystore.myshopify.com - Reason: Security maintenance
```

**During invalidation**:
```
Successfully invalidated session abc-123 for shop: mystore.myshopify.com
Force closed all SSE connections for shop: mystore.myshopify.com
```

**Post-invalidation**:
```
Admin session invalidation completed: 3 of 3 sessions invalidated for shop: mystore.myshopify.com
```

### **2. Audit Events**

**Event Type**: `ADMIN_SESSION_INVALIDATION`
**Message**: `Admin admin_user invalidated 3 sessions for shop mystore.myshopify.com - Reason: Security maintenance`

### **3. Frontend Console Logs**

```
[EnterpriseSSE] Message received {type: "session_pre_invalidation", data: {...}}
[EnterpriseSSE] Message received {type: "session_invalidated", data: {...}}
Session invalidated by admin - forcing logout
```

## 🚀 **Benefits**

### **1. Proper Session Invalidation**
- ✅ Sessions are actually invalidated in database and Redis
- ✅ Users are forced to re-authenticate
- ✅ No lingering session data

### **2. User Experience**
- ✅ Pre-invalidation warnings allow users to save work
- ✅ Clear notifications about what's happening
- ✅ Automatic logout with re-authentication prompts

### **3. Security**
- ✅ Complete audit trail of all invalidations
- ✅ Proper authentication and authorization
- ✅ IP address tracking for security

### **4. Reliability**
- ✅ Graceful error handling
- ✅ Fallback mechanisms
- ✅ Detailed logging for debugging

## 🔄 **Migration from Old System**

### **Before (Old System)**:
```java
// Only sent notifications, didn't invalidate sessions
sseService.broadcastToAllShops("admin_logout", "Admin logged out", 5000);
```

### **After (New System)**:
```java
// Properly invalidates sessions with notifications
Map<String, Object> result = adminSessionInvalidationService.invalidateAllSessionsForShop(
    shopDomain, adminUsername, reason, clientIp);
```

## 📈 **Performance Considerations**

### **1. Batch Operations**
- Process multiple sessions efficiently
- Continue even if individual sessions fail
- Non-blocking SSE notifications

### **2. Redis Optimization**
- Use Redis for fast session validation
- Clear invalid session markers
- Optimize cache cleanup

### **3. Database Efficiency**
- Use direct queries to avoid lazy loading
- Transactional boundaries for consistency
- Proper indexing for session lookups

## 🎯 **Conclusion**

The new admin session invalidation system provides:

1. **Complete session invalidation** with proper cleanup
2. **Real-time user notifications** with pre and post-invalidation warnings
3. **Security compliance** with audit logging
4. **User-friendly experience** with clear notifications and re-authentication prompts
5. **Reliable operation** with proper error handling and fallbacks

This implementation replaces the previous notification-only approach with a comprehensive session management system that properly invalidates sessions while providing excellent user experience and security compliance. 