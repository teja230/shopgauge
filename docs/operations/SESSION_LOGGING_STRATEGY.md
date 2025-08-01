# Session Logging Strategy

## Overview

This document explains the intelligent logging strategy implemented for session-related errors to balance noise reduction with problem detection.

## Log Levels by Scenario

### 1. Expected Session Expiration (DEBUG level)
**When:** User has been inactive and session naturally expires
**Log Level:** `DEBUG`
**Example:** User hasn't used the app for 30+ minutes, then tries to access a protected endpoint

**Conditions that trigger DEBUG logging:**
- User inactive for > 30 minutes (based on `X-Last-Activity` header)
- Session-related endpoints (`/api/auth/`, `/api/session/`, `/api/user/`)
- GET requests (read-only operations)
- Redis key patterns indicating session expiration (`spring:session:storesight`, `session:`, `storesight`)

### 2. Unexpected Redis Issues (WARN level)
**When:** Redis key errors occur in unexpected contexts
**Log Level:** `WARN`
**Example:** Active user gets Redis key errors during POST operations

**Conditions that trigger WARN logging:**
- Redis key errors during active user sessions
- POST/PUT/DELETE operations with Redis key errors
- Non-session-related endpoints with Redis key errors
- Recent user activity (< 30 minutes) with Redis key errors

### 3. Other Session Errors (INFO level)
**When:** Non-Redis session-related errors
**Log Level:** `INFO`
**Example:** Session validation errors, authentication issues

## Benefits

### ✅ Reduced Noise
- Expected session expiration logs at DEBUG level
- Only appears in detailed logs, not production monitoring

### ✅ Problem Detection
- Unexpected Redis issues still log at WARN level
- You'll be alerted to actual problems that need attention
- Clear distinction between expected vs unexpected errors

### ✅ Context-Aware
- Considers user activity, request type, and endpoint
- Intelligent decision making based on multiple factors

## Monitoring Recommendations

### Production Monitoring
- **Alert on:** WARN level session errors (unexpected issues)
- **Ignore:** DEBUG level session errors (expected expiration)
- **Monitor:** INFO level session errors (other issues)

### Development/Staging
- **Enable:** DEBUG level logging to see all session activity
- **Review:** DEBUG logs periodically to understand session patterns

## Configuration

The logging strategy is implemented in:
- `SessionRepositoryErrorFilter.java`
- `GlobalSessionExceptionHandler.java`

Both use the `isExpectedSessionExpiration()` method to determine appropriate log levels.

## Troubleshooting

### If you're missing important errors:
1. Check that your monitoring system captures WARN level logs
2. Verify that unexpected Redis issues are being logged at WARN level
3. Review the conditions in `isExpectedSessionExpiration()` method

### If you're still getting too much noise:
1. Adjust the inactivity threshold (currently 30 minutes)
2. Modify the endpoint patterns in the expected session check
3. Add more specific conditions to the `isExpectedSessionExpiration()` method

### If you need more visibility:
1. Temporarily change DEBUG to INFO for expected session expiration
2. Add more detailed logging in the `isExpectedSessionExpiration()` method
3. Create custom loggers for specific session scenarios 