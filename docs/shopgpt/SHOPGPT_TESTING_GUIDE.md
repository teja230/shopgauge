# ShopGPT Testing Guide

## Overview
This guide provides step-by-step instructions for testing ShopGPT's context-aware features in both demo mode and live authenticated sessions.

## Prerequisites
- Access to the ShopGauge application (local or deployed)
- For live testing: A connected Shopify store
- Browser with developer console access for debugging

---

## Demo Mode Testing

### 1. Activate Demo Mode

#### Method A: URL Parameter
```
https://your-app-url.com/business-intelligence?demo=true
```

#### Method B: Direct Navigation
```
https://your-app-url.com/business-intelligence
```
(If demo mode is already active in localStorage)

#### Method C: From Homepage
1. Go to homepage
2. Click "Try Demo" button
3. System will automatically navigate to ShopGPT

### 2. Verify Demo Mode Activation

**Visual Indicators to Check:**
- [ ] "Demo Mode" chip appears in header subtitle
- [ ] Data context banner shows "Demo Data Active" in blue
- [ ] Loading message says "Loading demo data..."
- [ ] Shop name shows "demo-shopgauge.myshopify.com"

**Console Verification:**
Open browser console (F12) and look for:
```
🤖 ShopGPT: Loading data { shop: 'demo-shopgauge.myshopify.com', isDemoMode: true }
✅ ShopGPT: Data loaded successfully { ... }
```

### 3. Test Data Context Awareness

#### Check Data Context Banner
The banner should display:
- [ ] "Demo Data Active" status
- [ ] Last updated timestamp
- [ ] Data points count (should be > 0)
- [ ] Revenue figure (e.g., "$42,750")

#### Verify Aggregated Data
In console, check the data loaded:
```javascript
// Should show:
{
  shop: 'demo-shopgauge.myshopify.com',
  revenue: { total: 42750, growth: 8.3, ... },
  products: { total: 24, lowInventory: 3, ... },
  orders: { total: 156, abandonedCarts: 12, ... },
  competitors: [ ... 5 competitors ... ]
}
```

### 4. Test Dynamic Suggested Questions

**Expected Context-Specific Questions:**
- [ ] Low inventory alert: "I have 3 low-stock items. What should I do?"
- [ ] Competitor question: "How do I compare to my 5 competitors?"
- [ ] Abandoned cart question: "How can I reduce my 12 abandoned carts?"

**Verify:**
1. Questions appear in welcome section
2. Questions are clickable
3. Clicking a question populates input and submits

### 5. Test AI Responses

#### Test Revenue Questions
Ask: **"What is my revenue?"**

**Expected Response Should Include:**
- [ ] Actual demo revenue figure: "$42,750"
- [ ] Growth rate: "8.3%"
- [ ] Positive performance description
- [ ] Reference to timeframe (weekly trends)
- [ ] Average per product calculation

#### Test Product Questions  
Ask: **"What products do I have?"**

**Expected Response Should Include:**
- [ ] Product count: "24 active products"
- [ ] Low inventory alert: "3 products are running low"
- [ ] Total revenue reference
- [ ] Names of top products (if available)

#### Test Competitor Questions
Ask: **"How do I compare to my competitors?"**

**Expected Response Should Include:**
- [ ] Competitor count: "5 competitors"
- [ ] Daily monitoring cost
- [ ] Budget usage percentage
- [ ] Growth rate comparison
- [ ] ROI estimate

#### Test Improvement Questions
Ask: **"How can I improve my business?"**

**Expected Response Should Include:**
- [ ] Prioritized recommendations (numbered list)
- [ ] Specific action items (e.g., "Restock 3 low-inventory items")
- [ ] Impact ratings (High/Medium/Low)
- [ ] Estimated revenue increase percentage

### 6. Test Insight Cards

**Check All Four Cards:**
1. Executive Summary
2. Performance Trends
3. Cost Analysis
4. Strategic Recommendations

**For Each Card Verify:**
- [ ] Card loads without error
- [ ] Shows loading state initially
- [ ] Displays insight text with context
- [ ] Source badge appears (AI Generated/Rule-Based/Fallback)
- [ ] Cached badge (if applicable)
- [ ] Refresh button works
- [ ] Uses demo data metrics

**Click Refresh on One Card:**
- [ ] Card shows loading state
- [ ] New insight generates
- [ ] Source/cached badges update
- [ ] Console shows generation log

### 7. Test Timeframe Selector

**Switch Between Timeframes:**
1. Change from "7d" to "24h"
   - [ ] Insights regenerate
   - [ ] Responses reference "today"
   
2. Change to "30d"
   - [ ] Insights regenerate
   - [ ] Responses reference "this month"

**Ask timeframe-specific questions:**
- "What was my revenue today?" → Should detect 24h
- "How was performance this month?" → Should detect 30d

### 8. Test Chat Features

#### Streaming Effect
- [ ] Assistant responses appear word-by-word
- [ ] Blinking cursor visible during streaming
- [ ] Smooth animation

#### Follow-up Suggestions
- [ ] Suggestions appear after response completes
- [ ] Show 4 relevant questions
- [ ] Clickable and functional

#### Error Handling
- [ ] Demo-specific error messages
- [ ] Graceful failure
- [ ] Suggestions reappear after error

---

## Live Mode Testing

### 1. Authenticate with Shopify Store

**Login Process:**
1. Click "Connect Shopify Store"
2. Complete OAuth flow
3. Grant permissions
4. Redirect to dashboard

### 2. Navigate to ShopGPT
```
/business-intelligence
```

### 3. Verify Live Mode Activation

**Visual Indicators:**
- [ ] NO "Demo Mode" chip in header
- [ ] Data context banner shows "Live Data Connected" in green
- [ ] Your actual shop domain displays
- [ ] Loading says "Loading your business data..."

**Console Verification:**
```
🤖 ShopGPT: Loading data { 
  shop: 'your-store.myshopify.com', 
  isDemoMode: false 
}
✅ ShopGPT: Data loaded successfully {
  revenue: <your actual revenue>,
  products: <your actual product count>,
  ...
}
```

### 4. Verify Real Data Integration

#### Check Data Context Banner
Should show YOUR actual data:
- [ ] "Live Data Connected" status
- [ ] Current timestamp
- [ ] Your data point count
- [ ] YOUR actual revenue figure

#### Check Console for API Calls
Should see successful API responses:
```
✅ ShopGPT: Data loaded successfully {
  shop: 'your-store.myshopify.com',
  revenue: { total: <YOUR_REVENUE>, growth: <YOUR_GROWTH> },
  products: { total: <YOUR_PRODUCTS>, lowInventory: <YOUR_LOW_STOCK> },
  orders: { total: <YOUR_ORDERS>, abandonedCarts: <YOUR_CARTS> },
  competitors: [ <YOUR_COMPETITORS> ]
}
```

### 5. Test Context with Real Data

#### Suggested Questions Should Adapt
Check that questions reference YOUR data:
- [ ] If you have low inventory: "I have X low-stock items..."
- [ ] If monitoring competitors: "How do I compare to my X competitors?"
- [ ] If you have abandoned carts: "How can I reduce my X abandoned carts?"

#### Welcome Message Should Be Personalized
- [ ] Shows YOUR shop name
- [ ] Shows YOUR revenue
- [ ] Shows YOUR product count
- [ ] Shows YOUR order count
- [ ] References YOUR competitor count (if any)

### 6. Ask Questions About YOUR Data

#### Revenue Question
Ask: **"What is my revenue?"**

**Response Must Include:**
- [ ] YOUR actual revenue figure
- [ ] YOUR actual growth rate
- [ ] YOUR product count
- [ ] Performance assessment based on YOUR numbers

#### Product Question
Ask: **"Tell me about my products"**

**Response Must Include:**
- [ ] YOUR actual product count
- [ ] YOUR low inventory count (if any)
- [ ] Names of YOUR top products
- [ ] YOUR revenue reference

#### Specific Product Question
Ask: **"What is my top selling product?"**

**Response Must Include:**
- [ ] Name of YOUR actual top product
- [ ] Performance metrics for that product

#### Competitor Question (if applicable)
Ask: **"How am I doing compared to competitors?"**

**Response Must Include:**
- [ ] YOUR actual competitor count
- [ ] YOUR monitoring costs
- [ ] YOUR growth rate
- [ ] Competitive positioning based on YOUR data

### 7. Test Data Freshness

**Force Refresh:**
1. Note current timestamp in data banner
2. Click refresh on insight card
3. Verify timestamp updates
4. Check that data reflects latest state

**Test Cache:**
1. Navigate away from ShopGPT
2. Come back to ShopGPT
3. Should load from cache (faster)
4. Timestamp should match previous

### 8. Test With Different Store States

#### New Store (Minimal Data)
**Expected Behavior:**
- [ ] Graceful handling of zero/low metrics
- [ ] Helpful recommendations for getting started
- [ ] No errors for missing data

#### Established Store (Rich Data)
**Expected Behavior:**
- [ ] Detailed insights with specific numbers
- [ ] Top products named
- [ ] Trend analysis with historical context
- [ ] Comparative insights

#### Store With Issues
**If you have:**
- Low inventory: Verify urgent recommendations
- High abandoned carts: Verify optimization suggestions
- No competitors monitored: Verify setup recommendations

---

## Advanced Testing Scenarios

### Cross-Mode Testing

**Scenario 1: Demo → Live Transition**
1. Start in demo mode
2. Logout (clears demo flag)
3. Login with real store
4. Verify switch to live data
5. Check all context updates

**Scenario 2: Live → Demo Transition**
1. Start logged in
2. Logout
3. Access with `?demo=true`
4. Verify switch to demo data
5. Check demo indicators appear

### Data Consistency Testing

**Verify Same Data Across Pages:**
1. Note revenue on Dashboard
2. Check same revenue in ShopGPT responses
3. Verify product counts match
4. Confirm competitor counts align

**Test After Data Changes:**
1. Make a sale in Shopify
2. Wait for sync/cache expiry
3. Refresh ShopGPT
4. Verify new data reflected

### Performance Testing

**Load Time Verification:**
- [ ] Initial page load < 3 seconds
- [ ] Data aggregation < 2 seconds
- [ ] Insight generation < 3 seconds per card
- [ ] Chat response < 2 seconds

**Cache Performance:**
- [ ] First load: Full API calls
- [ ] Subsequent loads: Cache hits
- [ ] Check console for cache indicators

### Error Handling Testing

**Network Issues:**
1. Simulate offline mode
2. Verify graceful error messages
3. Check fallback data behavior

**API Failures:**
1. Test with backend down (if possible)
2. Verify demo fallback or clear errors
3. Check retry mechanisms

**Invalid Data:**
1. Test with missing metrics
2. Verify no crashes
3. Check fallback values used

---

## Debugging Guide

### Console Logs to Monitor

**Data Loading:**
```javascript
🔄 ShopGPT: Loading shop data
✅ ShopGPT: Data loaded successfully
❌ ShopGPT: Failed to load aggregated data
```

**Insight Generation:**
```javascript
🤖 ShopGPT: Processing question
🎨 Generating context-aware insight
✅ ShopGPT: Generated insight
❌ ShopGPT: Chat insight generation failed
```

### Common Issues and Solutions

#### Issue: "No data loaded"
**Check:**
- Is user authenticated?
- Is demo mode active?
- Are API endpoints accessible?
- Check browser console for errors

#### Issue: "Generic responses not using my data"
**Check:**
- Is aggregatedData populated?
- Check console logs for data values
- Verify API responses have data
- Check if demo mode is incorrectly active

#### Issue: "Suggested questions not adapting"
**Check:**
- Is aggregatedData available?
- Check getSuggestedQuestions() logic
- Verify data conditions (lowInventory > 0, etc.)

#### Issue: "Insight cards not refreshing"
**Check:**
- Click refresh button on card
- Check console for generation logs
- Verify no API errors
- Check cache status

---

## Test Checklist Summary

### Demo Mode ✓
- [ ] Activates via URL parameter
- [ ] Shows demo indicators
- [ ] Uses DEMO_DATA_BUNDLE
- [ ] Provides consistent demo experience
- [ ] Generates context-aware responses with demo data
- [ ] Dynamic suggested questions
- [ ] All insight cards work
- [ ] Timeframe selector works

### Live Mode ✓
- [ ] Connects to real Shopify data
- [ ] Shows live indicators
- [ ] Uses actual API responses
- [ ] Personalizes welcome message
- [ ] Generates responses with real metrics
- [ ] Adapts questions to actual data
- [ ] All insight cards reflect real data
- [ ] Data freshness indicators work

### Context Awareness ✓
- [ ] Uses actual shop name
- [ ] References real revenue figures
- [ ] Names top products
- [ ] Counts competitors accurately
- [ ] Identifies inventory issues
- [ ] Calculates conversions correctly
- [ ] Provides personalized recommendations
- [ ] Adapts to timeframe selection

### User Experience ✓
- [ ] Smooth loading states
- [ ] Clear error messages
- [ ] Intuitive interface
- [ ] Responsive design
- [ ] Helpful suggestions
- [ ] Easy navigation
- [ ] Visual feedback
- [ ] Performance optimized

---

## Reporting Issues

When reporting bugs, please include:
1. **Mode**: Demo or Live
2. **Shop**: Store name (if live)
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Console logs** (copy relevant logs)
7. **Screenshots** (if UI issue)
8. **Browser & version**

Example:
```
Mode: Live
Shop: test-store.myshopify.com
Steps: 
1. Logged in
2. Navigated to ShopGPT
3. Asked "What is my revenue?"
Expected: Should show my actual revenue from dashboard ($5,234)
Actual: Shows $0
Console: "❌ Failed to load revenue data"
Browser: Chrome 119
```

---

## Success Criteria

ShopGPT is working correctly when:

✅ **Demo Mode**: Provides realistic, consistent experience with demo data
✅ **Live Mode**: Uses actual shop data from APIs and Redis
✅ **Context Awareness**: All responses reference actual metrics
✅ **Data Accuracy**: Numbers match across Dashboard and ShopGPT
✅ **Personalization**: Questions and insights adapt to shop state
✅ **Performance**: Fast load times with effective caching
✅ **Error Handling**: Graceful failures with helpful messages
✅ **User Experience**: Intuitive, informative, and actionable

---

## Next Steps After Testing

1. **Document Results**: Note any issues found
2. **Report Bugs**: Use issue template above
3. **Suggest Improvements**: Based on UX observations
4. **Validate Fixes**: Retest after bug fixes
5. **Performance Audit**: Monitor in production
6. **User Feedback**: Collect from beta users

Happy Testing! 🚀

