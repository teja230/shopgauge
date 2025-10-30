# ShopGPT Quick Reference Guide

## 🚀 Quick Start

### Demo Mode
```
URL: /business-intelligence?demo=true
OR: Click "Try Demo" from homepage
```

### Live Mode
```
1. Login with Shopify store
2. Navigate to: /business-intelligence
```

---

## 🎨 Visual Indicators

### Demo Mode
- 🔵 Blue "Demo Mode" chip in header
- 🔵 Blue "Demo Data Active" banner
- Shop: `demo-shopgauge.myshopify.com`

### Live Mode
- 🟢 Green "Live Data Connected" banner
- Your actual shop domain
- Real-time metrics

---

## 📊 Key Features

### Data Context Banner
Shows at-a-glance:
- Mode (Demo/Live)
- Last update time
- Data points count
- Current revenue

### Dynamic Suggested Questions
Adapts based on:
- Low inventory items
- Competitor count
- Abandoned carts
- General performance

### AI Insight Cards
4 Types:
1. **Executive Summary** - Business overview
2. **Performance Trends** - Growth patterns
3. **Cost Analysis** - ROI and optimization
4. **Strategic Recommendations** - Action items

Each card shows:
- Source badge (AI/Rule-Based/Fallback)
- Cached status
- Individual refresh button

---

## 💬 Example Questions

### Revenue
- "What is my revenue?"
- "How is my revenue trending?"
- "What was my revenue last month?"

### Products
- "What are my top products?"
- "Tell me about my products"
- "What products should I focus on?"

### Competitors
- "How do I compare to competitors?"
- "Should I monitor competitors?"
- "What's my competitive position?"

### Optimization
- "How can I improve?"
- "What should I optimize?"
- "How do I increase revenue?"
- "What should I focus on?"

### Specific Metrics
- "How many orders do I have?"
- "What's my conversion rate?"
- "How many abandoned carts?"
- "Do I have low inventory items?"

---

## 🔧 Troubleshooting

### No Data Showing
1. Check if authenticated (live mode)
2. Check if demo mode is active (demo mode)
3. Refresh the page
4. Check console for errors

### Generic Responses
1. Verify data banner shows actual numbers
2. Check console logs for data loading
3. Ensure aggregatedData is populated
4. Try asking more specific questions

### Insight Cards Not Loading
1. Wait for initial data load (check banner)
2. Click individual refresh button
3. Check console for API errors
4. Verify network connection

---

## 🐛 Console Commands

### Check Demo Status
```javascript
console.log({
  isDemoMode: localStorage.getItem('demo_mode_active'),
  shop: sessionStorage.getItem('shop'),
  isAuth: localStorage.getItem('isAuthenticated')
});
```

### Activate Demo Mode (Dev Only)
```javascript
window.activateDemoMode(); // If available in dev
```

### Check Demo Status (Dev Only)
```javascript
window.checkDemoStatus(); // If available in dev
```

---

## 📈 Data Sources

### Demo Mode
Source: `DEMO_DATA_BUNDLE`
- Revenue: $42,750
- Products: 24 (3 low stock)
- Orders: 156
- Abandoned Carts: 12
- Competitors: 5

### Live Mode
Sources:
- `/api/analytics/revenue`
- `/api/analytics/products`
- `/api/analytics/inventory/low`
- `/api/analytics/orders/timeseries`
- `/api/competitors`
- Redis cache

---

## ⚡ Performance

### Expected Load Times
- Page load: < 3 seconds
- Data aggregation: < 2 seconds
- Insight generation: < 3 seconds per card
- Chat response: < 2 seconds

### Caching
- TTL: 15 minutes
- Separate keys for demo/live
- Smart invalidation

---

## 📱 Timeframes

### Selector Options
- **24h** - "Last 24 Hours" - Recent activity
- **7d** - "Last 7 Days" - Weekly trends (default)
- **30d** - "Last 30 Days" - Monthly overview

### Auto-Detection
Questions with these keywords:
- "today", "yesterday", "now" → 24h
- "month", "monthly", "overall" → 30d
- Default → 7d

---

## 🎯 Best Practices

### For Best Results
1. **Be Specific**: Ask about specific metrics or products
2. **Use Context**: Reference timeframes or areas of concern
3. **Explore Cards**: Each card provides different insights
4. **Try Suggestions**: Suggested questions are tailored to your data
5. **Refresh Data**: Use refresh buttons for latest insights

### Demo Presentation Tips
1. Start with data context banner explanation
2. Show suggested questions adaptation
3. Ask varied question types
4. Demonstrate insight card refresh
5. Switch timeframes to show adaptation
6. Highlight specific data references in responses

---

## 📞 Support

### Documentation
- Technical: `docs/SHOPGPT_CONTEXT_AWARE_ENHANCEMENTS.md`
- Testing: `docs/SHOPGPT_TESTING_GUIDE.md`
- Summary: `SHOPGPT_ENHANCEMENTS_SUMMARY.md`
- Architecture: `docs/architecture/SHOPGPT_ARCHITECTURE.md`

### Reporting Issues
Include:
- Mode (Demo/Live)
- Shop name (if live)
- Steps to reproduce
- Console logs
- Screenshots

---

## ✅ Quick Test Checklist

### Demo Mode
- [ ] ?demo=true activates demo
- [ ] Blue indicators show
- [ ] Demo data displays
- [ ] Questions adapt to demo metrics
- [ ] Responses reference demo numbers

### Live Mode
- [ ] Authentication works
- [ ] Green indicators show
- [ ] Real data displays
- [ ] Questions adapt to actual metrics
- [ ] Responses reference real numbers

### Context Awareness
- [ ] Shop name shows correctly
- [ ] Revenue matches dashboard
- [ ] Product count accurate
- [ ] Competitors counted correctly
- [ ] Low inventory identified

---

## 🔗 Quick Links

### Navigation
- Dashboard: `/dashboard`
- ShopGPT: `/business-intelligence`
- Market Intelligence: `/competitors`
- Settings: `/settings`

### Demo Access
```
https://your-domain.com/business-intelligence?demo=true
```

---

**Last Updated**: October 30, 2025
**Version**: 1.0 (Context-Aware Release)

