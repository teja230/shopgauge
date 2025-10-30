# ShopGPT Documentation

This directory contains all documentation related to the ShopGPT (AI Business Intelligence) feature.

## Documents

### 1. [Context-Aware Enhancements](./SHOPGPT_CONTEXT_AWARE_ENHANCEMENTS.md)
Comprehensive technical documentation of the context-aware enhancements made to ShopGPT, including:
- Issues identified and fixed
- Implementation details
- Architecture and data flow
- Performance optimizations
- Future enhancements

### 2. [Testing Guide](./SHOPGPT_TESTING_GUIDE.md)
Step-by-step testing procedures for ShopGPT:
- Demo mode testing scenarios
- Live mode testing scenarios
- Context awareness verification
- Performance testing
- Debugging guide

### 3. [Enhancements Summary](./SHOPGPT_ENHANCEMENTS_SUMMARY.md)
Executive summary of all changes:
- Completed tasks checklist
- Key improvements
- Technical details
- Impact and benefits
- Demo presentation scripts

### 4. [Quick Reference](./SHOPGPT_QUICK_REFERENCE.md)
Quick start guide and reference:
- Demo mode activation
- Visual indicators
- Example questions
- Troubleshooting tips
- Console commands

## Overview

ShopGPT is an AI-powered business intelligence feature that provides:
- Context-aware insights based on actual shop data
- Natural language Q&A about business performance
- Automated insight generation
- Demo mode support with realistic data
- Real-time data integration with session and Redis

## Key Features

✅ **Context-Aware**: Uses actual shop metrics (revenue, products, orders, competitors)
✅ **Demo Support**: Works seamlessly with centralized DemoModeService
✅ **Live Data**: Integrates with session and Redis data
✅ **Dynamic Questions**: Suggested questions adapt to shop state
✅ **Rich Insights**: Formatted responses with markdown and emojis
✅ **Timeframe Selection**: 24h/7d/30d analysis periods
✅ **Source Indicators**: Shows AI/Rule-Based/Fallback badges
✅ **Cache Optimization**: Smart caching with 15-minute TTL

## Demo Mode Integration

ShopGPT integrates with the centralized demo mode system:

1. **Backend**: Uses `DemoModeService` (domain: `demo-shopgauge.myshopify.com`)
2. **Activation**: Via `/api/demo/start` endpoint
3. **Detection**: Checks `shop === 'demo-shopgauge.myshopify.com'`
4. **Data**: Uses unified `DEMO_DATA_BUNDLE` for consistency

**No ShopGPT-specific demo parameters needed** - it automatically detects when the authenticated shop is the demo store.

## Architecture

```
AuthContext (shop)
    ↓
BusinessIntelligencePage (checks isDemoMode)
    ↓
dataAggregationService.aggregateShopData(shop)
    ↓
Detects if shop === 'demo-shopgauge.myshopify.com'
    ↓
[Demo] → DEMO_DATA_BUNDLE
[Live] → API calls → Redis cache
    ↓
aiInsightsService.generateInsight(data)
    ↓
Context-aware response with shop metrics
```

## Getting Started

### For Users
1. Activate demo mode from homepage or use existing Shopify authentication
2. Navigate to `/business-intelligence`
3. ShopGPT automatically detects mode and loads appropriate data
4. Ask questions or generate insights

### For Developers
1. Read [Context-Aware Enhancements](./SHOPGPT_CONTEXT_AWARE_ENHANCEMENTS.md) for technical details
2. Follow [Testing Guide](./SHOPGPT_TESTING_GUIDE.md) for validation
3. Use [Quick Reference](./SHOPGPT_QUICK_REFERENCE.md) for quick lookup

## Testing

### Demo Mode
```bash
# Start backend
cd backend
./gradlew bootRun

# Start frontend
cd frontend
npm run dev

# Access demo
# 1. Go to http://localhost:5173
# 2. Click "Try Demo"
# 3. Navigate to Business Intelligence (ShopGPT)
# 4. Verify demo mode indicators and data
```

### Live Mode
```bash
# 1. Authenticate with real Shopify store
# 2. Navigate to /business-intelligence
# 3. Verify live mode indicators
# 4. Check that responses use actual shop data
```

## Key Files

### Frontend
- `frontend/src/pages/BusinessIntelligencePage.tsx` - Main ShopGPT UI
- `frontend/src/services/aiInsightsService.ts` - AI insight generation
- `frontend/src/services/dataAggregationService.ts` - Data aggregation
- `frontend/src/context/AuthContext.tsx` - Authentication and demo detection

### Backend
- `backend/.../DemoModeService.java` - Centralized demo mode service
- `backend/.../DemoModeController.java` - Demo mode endpoints
- `backend/.../DemoDataService.java` - Demo data generation

## Common Issues

### Issue: "ShopGPT not showing demo data"
**Solution**: Verify shop cookie is set to `demo-shopgauge.myshopify.com` and demo mode flag is in localStorage.

### Issue: "Generic responses not using my data"
**Solution**: Check console logs for data loading. Ensure `aggregatedData` is populated with actual metrics.

### Issue: "Context not detected"
**Solution**: Verify `isDemoMode` is correctly set in BusinessIntelligencePage from AuthContext.

## Support

For issues or questions:
1. Check the [Testing Guide](./SHOPGPT_TESTING_GUIDE.md) for debugging steps
2. Review console logs for data flow
3. Verify demo mode activation with `/api/demo/status`

## Related Documentation

- [Main Architecture](../architecture/SHOPGPT_ARCHITECTURE.md)
- [Demo Mode Implementation](../user-guide/DEMO_MODE_IMPLEMENTATION.md)
- [Session Management](../architecture/SESSION_MANAGEMENT_ARCHITECTURE.md)

---

**Last Updated**: October 30, 2025
**Version**: 1.0 (Context-Aware with Centralized Demo Mode)

