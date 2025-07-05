// Manual test to validate the analytics data fixes
// This simulates the exact scenario where session storage has data but validation fails

interface TestUnifiedAnalyticsData {
  historical: any[];
  predictions: any[];
  period_days?: number;
  total_revenue?: number;
  total_orders?: number;
}

// Sample data that mimics what might be in session storage
const sampleSessionStorageData: TestUnifiedAnalyticsData = {
  historical: [
    {
      kind: 'historical',
      date: '2025-01-01',
      revenue: 1200.50,
      orders_count: 15,
      conversion_rate: 3.2,
      avg_order_value: 80.03,
      isPrediction: false,
    },
    {
      kind: 'historical',
      date: '2025-01-02',
      revenue: 980.75,
      orders_count: 12,
      conversion_rate: 2.8,
      avg_order_value: 81.73,
      isPrediction: false,
    },
    {
      kind: 'historical',
      date: '2025-01-03',
      revenue: 1350.25,
      orders_count: 18,
      conversion_rate: 3.5,
      avg_order_value: 75.01,
      isPrediction: false,
    },
  ],
  predictions: [
    {
      kind: 'prediction',
      date: '2025-01-04',
      revenue: 1100.00,
      orders_count: 13,
      conversion_rate: 3.0,
      avg_order_value: 84.62,
      isPrediction: true,
      confidence_score: 0.85,
      confidence_interval: {
        revenue_min: 770.00,
        revenue_max: 1430.00,
        orders_min: 9,
        orders_max: 17,
      },
    },
    {
      kind: 'prediction',
      date: '2025-01-05',
      revenue: 1250.00,
      orders_count: 16,
      conversion_rate: 3.1,
      avg_order_value: 78.13,
      isPrediction: true,
      confidence_score: 0.82,
      confidence_interval: {
        revenue_min: 875.00,
        revenue_max: 1625.00,
        orders_min: 11,
        orders_max: 21,
      },
    },
  ],
  period_days: 60,
  // Note: total_revenue and total_orders are missing - this is the issue!
};

// Test functions that replicate the validation logic
export const testValidation = () => {
  console.log('=== ANALYTICS DATA VALIDATION TEST ===');
  
  // Test 1: Original strict validation (should fail)
  console.log('\n1. Testing STRICT validation (old logic):');
  const strictValid = sampleSessionStorageData && 
    Array.isArray(sampleSessionStorageData.historical) && 
    Array.isArray(sampleSessionStorageData.predictions) &&
    typeof sampleSessionStorageData.total_revenue === 'number' &&
    typeof sampleSessionStorageData.total_orders === 'number';
  
  console.log('Strict validation result:', strictValid);
  console.log('Expected: false (this is why it was failing)');
  
  // Test 2: New simplified validation (should pass)
  console.log('\n2. Testing SIMPLIFIED validation (new logic):');
  const simplifiedValid = sampleSessionStorageData && 
    Array.isArray(sampleSessionStorageData.historical) && 
    Array.isArray(sampleSessionStorageData.predictions);
  
  console.log('Simplified validation result:', simplifiedValid);
  console.log('Expected: true (this should now pass)');
  
  // Test 3: Auto-fix logic
  console.log('\n3. Testing AUTO-FIX logic:');
  const calculatedTotalRevenue = sampleSessionStorageData.historical.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const calculatedTotalOrders = sampleSessionStorageData.historical.reduce((sum, item) => sum + (item.orders_count || 0), 0);
  
  const fixedData = {
    ...sampleSessionStorageData,
    total_revenue: calculatedTotalRevenue,
    total_orders: calculatedTotalOrders,
    period_days: sampleSessionStorageData.period_days || 60
  };
  
  console.log('Original data totals:', {
    total_revenue: sampleSessionStorageData.total_revenue,
    total_orders: sampleSessionStorageData.total_orders
  });
  
  console.log('Calculated totals:', {
    calculatedTotalRevenue,
    calculatedTotalOrders
  });
  
  console.log('Fixed data totals:', {
    total_revenue: fixedData.total_revenue,
    total_orders: fixedData.total_orders
  });
  
  // Test 4: Final validation after fix
  console.log('\n4. Testing validation AFTER auto-fix:');
  const finalValid = fixedData && 
    Array.isArray(fixedData.historical) && 
    Array.isArray(fixedData.predictions) &&
    typeof fixedData.total_revenue === 'number' &&
    typeof fixedData.total_orders === 'number';
  
  console.log('Final validation result:', finalValid);
  console.log('Expected: true (data should be valid for rendering)');
  
  // Test 5: Chart data transformation
  console.log('\n5. Testing chart data transformation:');
  const chartData = [...fixedData.historical, ...fixedData.predictions.slice(0, 30)].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const revenueData = chartData.map(item => ({
    date: item.date,
    revenue: item.revenue,
    isPrediction: Boolean(item.isPrediction)
  }));
  
  console.log('Chart data length:', chartData.length);
  console.log('Revenue data length:', revenueData.length);
  console.log('Revenue data sample:', revenueData.slice(0, 3));
  
  console.log('\n=== TEST COMPLETE ===');
  console.log('Summary: The new validation logic should fix the issue where session storage data exists but charts don\'t render.');
  
  return {
    strictValid,
    simplifiedValid,
    fixedData,
    finalValid,
    chartData,
    revenueData
  };
};

// Function to simulate the complete flow
export const simulateCompleteFlow = () => {
  console.log('=== SIMULATING COMPLETE ANALYTICS FLOW ===');
  
  // Step 1: Simulate session storage load
  console.log('\n1. Simulating session storage load...');
  const storageData = { ...sampleSessionStorageData };
  console.log('Loaded from storage:', {
    hasHistorical: Array.isArray(storageData.historical),
    historicalLength: storageData.historical?.length || 0,
    hasPredictions: Array.isArray(storageData.predictions),
    predictionsLength: storageData.predictions?.length || 0,
    hasTotals: !!(storageData.total_revenue && storageData.total_orders)
  });
  
  // Step 2: Apply auto-fix
  console.log('\n2. Applying auto-fix...');
  const calculatedTotalRevenue = storageData.historical.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const calculatedTotalOrders = storageData.historical.reduce((sum, item) => sum + (item.orders_count || 0), 0);
  
  const fixedData = {
    ...storageData,
    total_revenue: calculatedTotalRevenue,
    total_orders: calculatedTotalOrders,
    period_days: storageData.period_days || 60
  };
  
  console.log('Auto-fix applied:', {
    total_revenue: fixedData.total_revenue,
    total_orders: fixedData.total_orders,
    period_days: fixedData.period_days
  });
  
  // Step 3: Validate for PredictionViewContainer
  console.log('\n3. Validating for PredictionViewContainer...');
  const validForContainer = fixedData && 
    Array.isArray(fixedData.historical) && 
    fixedData.historical.length > 0;
  
  console.log('Valid for container:', validForContainer);
  
  // Step 4: Transform data for charts
  console.log('\n4. Transforming data for charts...');
  const combinedData = [...fixedData.historical, ...fixedData.predictions.slice(0, 30)].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  const transformedData = {
    revenue: combinedData.map(item => ({
      date: item.date,
      revenue: item.revenue,
      isPrediction: Boolean(item.isPrediction)
    })),
    orders: combinedData.map(item => ({
      date: item.date,
      orders_count: item.orders_count,
      isPrediction: Boolean(item.isPrediction)
    })),
    conversion: combinedData.map(item => ({
      date: item.date,
      conversion_rate: item.conversion_rate || 0,
      isPrediction: Boolean(item.isPrediction)
    }))
  };
  
  console.log('Transformed data lengths:', {
    revenue: transformedData.revenue.length,
    orders: transformedData.orders.length,
    conversion: transformedData.conversion.length
  });
  
  // Step 5: Final validation
  console.log('\n5. Final validation for chart rendering...');
  const readyForCharts = transformedData.revenue.length > 0 && 
    transformedData.orders.length > 0 && 
    transformedData.conversion.length > 0;
  
  console.log('Ready for charts:', readyForCharts);
  
  console.log('\n=== SIMULATION COMPLETE ===');
  console.log('Result: Charts should now render successfully with the fixed data!');
  
  return {
    storageData,
    fixedData,
    validForContainer,
    transformedData,
    readyForCharts
  };
};

// Add functions to window for easy access in browser console
if (typeof window !== 'undefined') {
  (window as any).testValidation = testValidation;
  (window as any).simulateCompleteFlow = simulateCompleteFlow;
}

export { sampleSessionStorageData }; 