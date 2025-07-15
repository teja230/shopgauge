# SSE Admin Card - Real-Time Connection Monitoring

## Overview

The SSE (Server-Sent Events) Admin Card provides administrators with real-time monitoring and insights into the SSE connection infrastructure used for instant session invalidation across the ShopGauge platform.

## Features

### 🎯 **Real-Time Connection Monitoring**
- **Active Connections**: Live count of current SSE connections
- **Active Shops**: Number of shops with active SSE connections
- **Connection Utilization**: Visual progress bar showing current usage vs. limits
- **Health Status**: Automated health assessment with recommendations

### 📊 **Key Metrics Dashboard**
- **Total Errors**: Cumulative count of SSE connection errors
- **Rate Limited**: Number of connections blocked due to rate limiting
- **Connection Limits**: Display of global and per-shop connection limits
- **Shop Breakdown**: Detailed view of connections per individual shop

### 🔄 **Interactive Features**
- **Auto-refresh**: 30-second cooldown between manual refreshes
- **Real-time Updates**: Live data from the backend SSE statistics endpoint
- **Health Alerts**: Color-coded status indicators (Healthy/Warning/Critical)
- **Responsive Design**: Optimized for desktop and mobile admin interfaces

## Technical Implementation

### Backend Endpoint
```
GET /api/sessions/admin/sse/stats
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "totalConnections": 150,
    "totalErrors": 5,
    "totalRateLimited": 2,
    "activeConnections": 25,
    "activeShops": 8,
    "maxGlobalConnections": 50,
    "maxPerShopConnections": 5,
    "connectionsByShop": {
      "shop1.myshopify.com": 3,
      "shop2.myshopify.com": 2
    }
  },
  "health": {
    "connectionUtilization": "50.0%",
    "status": "HEALTHY",
    "recommendation": "Normal operation"
  },
  "timestamp": "2024-01-15T10:30:00"
}
```

### Frontend Component
- **File**: `frontend/src/components/ui/SseStatsCard.tsx`
- **API Integration**: `frontend/src/api/admin.ts` - `getAdminSseStats()`
- **Location**: Admin Panel → Sessions & Shops Tab

## Usage

### Accessing the SSE Card
1. Navigate to the Admin Panel
2. Click on the "Sessions & Shops" tab
3. The SSE Statistics card appears above the Advanced Session Management section

### Understanding the Metrics

#### Connection Utilization
- **Green (0-60%)**: Healthy operation
- **Yellow (60-80%)**: Moderate usage, monitor closely
- **Red (80%+)**: High usage, consider increasing limits

#### Health Status
- **HEALTHY**: Normal operation, no action required
- **WARNING**: Elevated usage, monitor for potential issues
- **CRITICAL**: High usage, immediate attention recommended

#### Shop Connections
- Shows individual shop connection counts
- Highlights shops approaching or exceeding per-shop limits
- Sorted by connection count (highest first)

## Benefits

### For Administrators
- **Proactive Monitoring**: Identify connection issues before they impact users
- **Capacity Planning**: Understand current usage patterns and plan for growth
- **Troubleshooting**: Quick access to connection statistics for debugging
- **Performance Optimization**: Monitor connection efficiency and health

### For System Health
- **Real-time Visibility**: Live monitoring of SSE infrastructure
- **Early Warning System**: Alerts when connection limits are approached
- **Resource Management**: Optimize connection limits based on usage patterns
- **Reliability**: Ensure SSE connections remain stable for session invalidation

## Configuration

### Connection Limits
- **Global Limit**: 50 concurrent SSE connections (configurable)
- **Per-Shop Limit**: 5 connections per shop (configurable)
- **Timeout**: 2 minutes for idle connections
- **Heartbeat**: 30-second intervals to maintain connections

### Health Thresholds
- **Warning Level**: 80% connection utilization
- **Critical Level**: 95% connection utilization
- **Auto-cleanup**: Stale connections removed every minute

## Integration with Existing Features

### Session Management
- Works alongside the existing AdminSessionManager
- Provides context for session invalidation operations
- Helps understand the impact of session management actions

### Real-time Session Invalidation
- SSE connections enable instant logout across all user sessions
- The card monitors the health of this critical infrastructure
- Ensures reliable delivery of session invalidation events

## Future Enhancements

### Planned Features
- **Historical Trends**: Connection usage over time
- **Alert Notifications**: Email/SMS alerts for critical thresholds
- **Connection Analytics**: Detailed connection lifecycle metrics
- **Auto-scaling**: Dynamic adjustment of connection limits

### Monitoring Improvements
- **Connection Quality**: Latency and reliability metrics
- **Geographic Distribution**: Connection locations and performance
- **Error Analysis**: Detailed error categorization and trends
- **Predictive Alerts**: AI-powered capacity forecasting

## Troubleshooting

### Common Issues

#### High Connection Utilization
- **Symptom**: Utilization > 80%
- **Cause**: Many concurrent users or connection leaks
- **Solution**: Increase global limits or investigate connection cleanup

#### High Error Rate
- **Symptom**: Total errors increasing rapidly
- **Cause**: Network issues or invalid sessions
- **Solution**: Check network connectivity and session validation

#### Shop Connection Limits
- **Symptom**: Individual shops hitting per-shop limits
- **Cause**: Multiple browser tabs or devices per shop
- **Solution**: Review session management policies

### Debug Information
- All SSE statistics are logged in the backend
- Connection events are tracked with timestamps
- Error details are available in server logs
- Health status changes are logged for monitoring

---

**Note**: The SSE Admin Card is part of the comprehensive session management system that ensures secure, reliable, and efficient user session handling across the ShopGauge platform. 