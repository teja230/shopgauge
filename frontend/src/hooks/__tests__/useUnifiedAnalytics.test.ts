// Unit test for useUnifiedAnalytics validation logic
// This file tests the validation logic that's causing the session storage issues

// Mock interfaces to match the actual types
interface UnifiedAnalyticsData {
  historical: HistoricalData[];
  predictions: PredictionData[];
  period_days: number;
  total_revenue: number;
  total_orders: number;
}

interface HistoricalData {
  kind: 'historical';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction: false;
}

interface PredictionData {
  kind: 'prediction';
  date: string;
  revenue: number;
  orders_count: number;
  conversion_rate: number;
  avg_order_value: number;
  isPrediction: true;
  confidence_score: number;
  confidence_interval?: {
    revenue_min: number;
    revenue_max: number;
    orders_min: number;
    orders_max: number;
  };
}

// Sample data based on the user's session storage structure
const sampleSessionStorageData: UnifiedAnalyticsData = {
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
  ],
  predictions: [
    {
      kind: 'prediction',
      date: '2025-01-03',
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
  ],
  period_days: 60,
  total_revenue: 2181.25,
  total_orders: 27,
};

// Sample data missing total_revenue and total_orders (potential issue)
const sampleSessionStorageDataMissingTotals = {
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
  ],
  predictions: [
    {
      kind: 'prediction',
      date: '2025-01-03',
      revenue: 1100.00,
      orders_count: 13,
      conversion_rate: 3.0,
      avg_order_value: 84.62,
      isPrediction: true,
      confidence_score: 0.85,
    },
  ],
  period_days: 60,
  // Missing total_revenue and total_orders - this is likely the validation issue
};

// Test functions that replicate the validation logic from useUnifiedAnalytics
function validateBasicStructure(data: any): boolean {
  return data && 
    Array.isArray(data.historical) && 
    Array.isArray(data.predictions) &&
    typeof data.total_revenue === 'number' &&
    typeof data.total_orders === 'number';
}

function validateHistoricalData(data: any): boolean {
  if (!data || !Array.isArray(data.historical)) return false;
  
  return data.historical.length === 0 || data.historical.every((item: any) => 
    item && 
    typeof item.date === 'string' && 
    typeof item.revenue === 'number' && 
    typeof item.orders_count === 'number'
  );
}

function generateStorageKey(shop: string, days: number, includePredictions: boolean): string {
  return `unified_analytics_${shop}_${days}d_${includePredictions ? 'with' : 'no'}_predictions`;
}

// Test runner function
function runTests() {
  console.log('=== UNIFIED ANALYTICS VALIDATION TESTS ===\n');

  // Test 1: Valid data structure
  console.log('Test 1: Valid data structure');
  const validResult = validateBasicStructure(sampleSessionStorageData);
  console.log('Result:', validResult ? 'PASS' : 'FAIL');
  console.log('Expected: PASS\n');

  // Test 2: Missing total fields (this is the issue)
  console.log('Test 2: Missing total_revenue and total_orders');
  const missingTotalsResult = validateBasicStructure(sampleSessionStorageDataMissingTotals);
  console.log('Result:', missingTotalsResult ? 'PASS' : 'FAIL');
  console.log('Expected: FAIL (this is the root cause of the issue)');
  console.log('Has total_revenue:', 'total_revenue' in sampleSessionStorageDataMissingTotals);
  console.log('Has total_orders:', 'total_orders' in sampleSessionStorageDataMissingTotals);
  console.log('total_revenue type:', typeof (sampleSessionStorageDataMissingTotals as any).total_revenue);
  console.log('total_orders type:', typeof (sampleSessionStorageDataMissingTotals as any).total_orders);
  console.log('');

  // Test 3: Historical data validation
  console.log('Test 3: Historical data validation');
  const historicalResult = validateHistoricalData(sampleSessionStorageData);
  console.log('Result:', historicalResult ? 'PASS' : 'FAIL');
  console.log('Expected: PASS\n');

  // Test 4: Storage key generation
  console.log('Test 4: Storage key generation');
  const shop = 'storesight.myshopify.com';
  const key = generateStorageKey(shop, 60, true);
  const expectedKey = 'unified_analytics_storesight.myshopify.com_60d_with_predictions';
  console.log('Generated key:', key);
  console.log('Expected key:', expectedKey);
  console.log('Result:', key === expectedKey ? 'PASS' : 'FAIL');
  console.log('');

  // Test 5: Real-world scenario (user's actual data)
  console.log('Test 5: Real-world scenario (user\'s actual data)');
  const userSessionData = {
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
    ],
    predictions: Array.from({ length: 30 }, (_, i) => ({
      kind: 'prediction',
      date: `2025-01-${String(i + 2).padStart(2, '0')}`,
      revenue: 1000 + Math.random() * 500,
      orders_count: 10 + Math.floor(Math.random() * 10),
      conversion_rate: 2.5 + Math.random() * 2,
      avg_order_value: 75 + Math.random() * 25,
      isPrediction: true,
      confidence_score: 0.7 + Math.random() * 0.2,
    })),
    period_days: 60,
    // Note: Missing total_revenue and total_orders - this is the root cause
  };

  console.log('Historical count:', userSessionData.historical.length);
  console.log('Predictions count:', userSessionData.predictions.length);
  console.log('Keys present:', Object.keys(userSessionData));
  
  const userValidationResult = validateBasicStructure(userSessionData);
  console.log('Validation result:', userValidationResult ? 'PASS' : 'FAIL');
  console.log('Expected: FAIL (this is why charts show loading)');
  console.log('Missing total_revenue:', !('total_revenue' in userSessionData));
  console.log('Missing total_orders:', !('total_orders' in userSessionData));
  console.log('');

  // Test 6: Auto-fix approach
  console.log('Test 6: Auto-fix approach');
  const autoFixedData = {
    ...userSessionData,
    total_revenue: userSessionData.historical.reduce((sum, item) => sum + item.revenue, 0),
    total_orders: userSessionData.historical.reduce((sum, item) => sum + item.orders_count, 0),
  };

  const autoFixedValidation = validateBasicStructure(autoFixedData);
  console.log('Auto-fixed validation result:', autoFixedValidation ? 'PASS' : 'FAIL');
  console.log('Expected: PASS');
  console.log('Calculated total_revenue:', autoFixedData.total_revenue);
  console.log('Calculated total_orders:', autoFixedData.total_orders);
  console.log('');

  // Test 7: Proposed lenient validation
  console.log('Test 7: Proposed lenient validation');
  function lenientValidation(data: any): boolean {
    return data && 
      Array.isArray(data.historical) && 
      Array.isArray(data.predictions) &&
      (data.historical.length > 0 || data.predictions.length > 0);
  }

  const lenientResult = lenientValidation(userSessionData);
  console.log('Lenient validation result:', lenientResult ? 'PASS' : 'FAIL');
  console.log('Expected: PASS (this would solve the issue)');
  console.log('');

  // Summary
  console.log('=== SUMMARY ===');
  console.log('ROOT CAUSE: The validation is failing because session storage data is missing total_revenue and total_orders fields');
  console.log('SOLUTION OPTIONS:');
  console.log('1. Auto-calculate missing totals from historical data');
  console.log('2. Use lenient validation that only checks for data presence');
  console.log('3. Add total fields when saving data to session storage');
  console.log('');
  console.log('RECOMMENDED: Option 1 (auto-calculate) with fallback to Option 2 (lenient validation)');
}

// Export functions for potential use in actual tests
export {
  validateBasicStructure,
  validateHistoricalData,
  generateStorageKey,
  runTests,
  sampleSessionStorageData,
  sampleSessionStorageDataMissingTotals,
};

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  runTests();
}
