// Debug utility to inspect session storage data for unified analytics
export const debugSessionStorage = () => {
  console.log('=== SESSION STORAGE DEBUG ===');
  
  const unifiedAnalyticsKeys = [];
  const allKeys = [];
  
  // Get all keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      allKeys.push(key);
      if (key.includes('unified_analytics')) {
        unifiedAnalyticsKeys.push(key);
      }
    }
  }
  
  console.log('All session storage keys:', allKeys);
  console.log('Unified analytics keys:', unifiedAnalyticsKeys);
  
  // Inspect each unified analytics key
  unifiedAnalyticsKeys.forEach(key => {
    console.log(`\n=== KEY: ${key} ===`);
    
    try {
      const rawData = sessionStorage.getItem(key);
      if (!rawData) {
        console.log('No data found for key');
        return;
      }
      
      console.log('Raw data length:', rawData.length);
      console.log('Raw data sample:', rawData.substring(0, 200) + '...');
      
      const parsed = JSON.parse(rawData);
      console.log('Parsed data structure:', {
        keys: Object.keys(parsed),
        hasHistorical: Array.isArray(parsed.historical),
        historicalLength: parsed.historical?.length || 0,
        historicalSample: parsed.historical?.slice(0, 2),
        hasPredictions: Array.isArray(parsed.predictions),
        predictionsLength: parsed.predictions?.length || 0,
        predictionsSample: parsed.predictions?.slice(0, 2),
        hasTotalRevenue: 'total_revenue' in parsed,
        totalRevenue: parsed.total_revenue,
        totalRevenueType: typeof parsed.total_revenue,
        hasTotalOrders: 'total_orders' in parsed,
        totalOrders: parsed.total_orders,
        totalOrdersType: typeof parsed.total_orders,
        hasPeriodDays: 'period_days' in parsed,
        periodDays: parsed.period_days,
        allFields: Object.keys(parsed)
      });
      
      // Validate the structure
      const validationResults = {
        hasBasicStructure: parsed && Array.isArray(parsed.historical) && Array.isArray(parsed.predictions),
        hasValidHistorical: parsed.historical && parsed.historical.length > 0 && parsed.historical.every((item: any) => 
          item && 
          typeof item.date === 'string' && 
          typeof item.revenue === 'number' && 
          typeof item.orders_count === 'number' &&
          !isNaN(item.revenue) &&
          !isNaN(item.orders_count)
        ),
        hasValidTotals: typeof parsed.total_revenue === 'number' && typeof parsed.total_orders === 'number',
        calculatedTotalRevenue: parsed.historical?.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0),
        calculatedTotalOrders: parsed.historical?.reduce((sum: number, item: any) => sum + (item.orders_count || 0), 0)
      };
      
      console.log('Validation results:', validationResults);
      
      // Check if historical data items have all required fields
      if (parsed.historical && parsed.historical.length > 0) {
        const sampleItem = parsed.historical[0];
        console.log('Sample historical item:', sampleItem);
        console.log('Sample historical item fields:', Object.keys(sampleItem));
        console.log('Sample historical item validation:', {
          hasDate: typeof sampleItem.date === 'string',
          hasRevenue: typeof sampleItem.revenue === 'number',
          hasOrdersCount: typeof sampleItem.orders_count === 'number',
          hasConversionRate: 'conversion_rate' in sampleItem,
          hasAvgOrderValue: 'avg_order_value' in sampleItem,
          hasKind: 'kind' in sampleItem,
          hasIsPrediction: 'isPrediction' in sampleItem
        });
      }
      
    } catch (error) {
      console.error('Failed to parse data for key:', key, error);
    }
  });
  
  console.log('\n=== END SESSION STORAGE DEBUG ===');
};

// Function to fix session storage data
export const fixSessionStorageData = () => {
  console.log('=== FIXING SESSION STORAGE DATA ===');
  
  const unifiedAnalyticsKeys = [];
  
  // Get all unified analytics keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes('unified_analytics')) {
      unifiedAnalyticsKeys.push(key);
    }
  }
  
  unifiedAnalyticsKeys.forEach(key => {
    console.log(`Fixing key: ${key}`);
    
    try {
      const rawData = sessionStorage.getItem(key);
      if (!rawData) return;
      
      const parsed = JSON.parse(rawData);
      
      // Calculate totals if missing
      if (!parsed.total_revenue || !parsed.total_orders) {
        const calculatedTotalRevenue = parsed.historical?.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0) || 0;
        const calculatedTotalOrders = parsed.historical?.reduce((sum: number, item: any) => sum + (item.orders_count || 0), 0) || 0;
        
        const fixedData = {
          ...parsed,
          total_revenue: calculatedTotalRevenue,
          total_orders: calculatedTotalOrders,
          period_days: parsed.period_days || 60
        };
        
        sessionStorage.setItem(key, JSON.stringify(fixedData));
        console.log(`Fixed data for key ${key}:`, {
          originalTotalRevenue: parsed.total_revenue,
          originalTotalOrders: parsed.total_orders,
          calculatedTotalRevenue,
          calculatedTotalOrders
        });
      } else {
        console.log(`Data for key ${key} already has totals`);
      }
      
    } catch (error) {
      console.error(`Failed to fix data for key ${key}:`, error);
    }
  });
  
  console.log('=== END FIXING SESSION STORAGE DATA ===');
};

// Add to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).debugSessionStorage = debugSessionStorage;
  (window as any).fixSessionStorageData = fixSessionStorageData;
} 