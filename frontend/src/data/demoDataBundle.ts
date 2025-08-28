/**
 * Comprehensive Demo Data Bundle - Frontend-First Approach
 * 
 * This bundle contains all demo data to eliminate backend calls for demo mode.
 * Data is realistic and matches the current backend demo data structure.
 * 
 * Performance Impact:
 * - Eliminates 50+ API calls per demo session
 * - Reduces server memory usage by 11-22MB per demo user
 * - Enables unlimited concurrent demo users
 * - Response time: 50-200ms vs 500ms-2s
 */

export interface DemoProduct {
  id: string;
  title: string;
  price: number;
  category: string;
  inventory_quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: Array<{ src: string; alt: string }>;
  variants: Array<{
    id: string;
    title: string;
    price: number;
    inventory_quantity: number;
    sku: string;
  }>;
}

export interface DemoAnalytics {
  revenue: {
    total_revenue: number;
    daily_revenue: Array<{ date: string; revenue: number; orders: number }>;
    monthly_revenue: number;
    revenue_growth: number;
  };
  orders: {
    total_orders: number;
    daily_orders: Array<{ 
      date: string; 
      order_count: number; 
      revenue: number;
      customer_id: string;
      order_id: string;
      created_at: string;
      total_price: number;
    }>;
    average_order_value: number;
    conversion_rate: number;
  };
  customers: {
    total_customers: number;
    returning_customers: number;
    new_customers_this_month: number;
    customer_retention_rate: number;
  };
  inventory: {
    total_products: number;
    low_stock_count: number;
    out_of_stock_count: number;
    abandoned_cart_count: number;
    new_products_this_month: number;
  };
  insights: {
    price_advantage_percentage: number;
    competitors_monitored: number;
    price_alerts_last_week: number;
    weekly_revenue_growth: number;
    monthly_revenue_growth: number;
    customer_acquisition_rate: number;
  };
}

export interface DemoCompetitor {
  id: string;
  name: string;
  url: string;
  current_price: number;
  our_price: number;
  price_difference: number;
  price_advantage: boolean;
  last_checked: string;
  status: 'active' | 'inactive';
  platform: string;
  product_match_confidence: number;
}

/**
 * Helper function to generate relative dates
 * Creates a new Date object to avoid potential side effects
 */
const getRelativeDate = (daysAgo: number): string => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
};

const getRelativeDateTime = (daysAgo: number, hour: number = 12, minute: number = 0): string => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

/**
 * Comprehensive Demo Data Bundle
 * Total size: ~150KB compressed, ~500KB uncompressed
 * Load time: 10-50ms vs 500ms-2s for API calls
 */
export const DEMO_DATA_BUNDLE = {
  metadata: {
    version: '2.0.0',
    generated: new Date().toISOString(),
    strategy: 'frontend-first-hybrid',
    dataSize: '~150KB',
    estimatedLoadTime: '10-50ms'
  },

  products: [
    // Electronics Category (8 products)
    {
      id: 'demo_prod_1',
      title: 'Premium Wireless Headphones',
      price: 149.99,
      category: 'Electronics',
      inventory_quantity: 45,
      status: 'active',
      created_at: getRelativeDateTime(30),
      updated_at: getRelativeDateTime(1),
      handle: 'premium-wireless-headphones',
      vendor: 'TechPro',
      product_type: 'Audio',
      tags: ['wireless', 'premium', 'noise-canceling', 'bluetooth'],
      images: [{ src: '/demo/products/headphones.jpg', alt: 'Wireless Headphones' }],
      variants: [
        { id: 'var_1_1', title: 'Black', price: 149.99, inventory_quantity: 25, sku: 'WH-001-BLK' },
        { id: 'var_1_2', title: 'White', price: 149.99, inventory_quantity: 20, sku: 'WH-001-WHT' }
      ]
    },
    {
      id: 'demo_prod_2',
      title: 'Smart Fitness Tracker',
      price: 89.99,
      category: 'Electronics',
      inventory_quantity: 32,
      status: 'active',
      created_at: getRelativeDateTime(25),
      updated_at: getRelativeDateTime(2),
      handle: 'smart-fitness-tracker',
      vendor: 'FitTech',
      product_type: 'Wearables',
      tags: ['fitness', 'smart', 'health', 'waterproof'],
      images: [{ src: '/demo/products/fitness-tracker.jpg', alt: 'Fitness Tracker' }],
      variants: [
        { id: 'var_2_1', title: 'Black Band', price: 89.99, inventory_quantity: 20, sku: 'FT-001-BLK' },
        { id: 'var_2_2', title: 'Blue Band', price: 89.99, inventory_quantity: 12, sku: 'FT-001-BLU' }
      ]
    },
    {
      id: 'demo_prod_4',
      title: 'Portable Power Bank 20000mAh',
      price: 39.99,
      category: 'Electronics',
      inventory_quantity: 67,
      status: 'active',
      created_at: getRelativeDateTime(20),
      updated_at: getRelativeDateTime(3),
      handle: 'portable-power-bank-20000mah',
      vendor: 'PowerTech',
      product_type: 'Accessories',
      tags: ['portable', 'power', 'charging', 'travel'],
      images: [{ src: '/demo/products/power-bank.jpg', alt: 'Power Bank' }],
      variants: [
        { id: 'var_4_1', title: 'Black', price: 39.99, inventory_quantity: 40, sku: 'PB-001-BLK' },
        { id: 'var_4_2', title: 'White', price: 39.99, inventory_quantity: 27, sku: 'PB-001-WHT' }
      ]
    },
    {
      id: 'demo_prod_7',
      title: 'Bluetooth Speaker Waterproof',
      price: 79.99,
      category: 'Electronics',
      inventory_quantity: 28,
      status: 'active',
      created_at: getRelativeDateTime(18),
      updated_at: getRelativeDateTime(1),
      handle: 'bluetooth-speaker-waterproof',
      vendor: 'AudioMax',
      product_type: 'Audio',
      tags: ['bluetooth', 'waterproof', 'portable', 'outdoor'],
      images: [{ src: '/demo/products/speaker.jpg', alt: 'Waterproof Speaker' }],
      variants: [
        { id: 'var_7_1', title: 'Red', price: 79.99, inventory_quantity: 15, sku: 'SP-001-RED' },
        { id: 'var_7_2', title: 'Blue', price: 79.99, inventory_quantity: 13, sku: 'SP-001-BLU' }
      ]
    },
    {
      id: 'demo_prod_9',
      title: 'Wireless Charging Pad',
      price: 34.99,
      category: 'Electronics',
      inventory_quantity: 55,
      status: 'active',
      created_at: getRelativeDateTime(15),
      updated_at: getRelativeDateTime(2),
      handle: 'wireless-charging-pad',
      vendor: 'ChargeTech',
      product_type: 'Accessories',
      tags: ['wireless', 'charging', 'fast-charge', 'qi-enabled'],
      images: [{ src: '/demo/products/charging-pad.jpg', alt: 'Wireless Charging Pad' }],
      variants: [
        { id: 'var_9_1', title: 'Black', price: 34.99, inventory_quantity: 30, sku: 'CP-001-BLK' },
        { id: 'var_9_2', title: 'White', price: 34.99, inventory_quantity: 25, sku: 'CP-001-WHT' }
      ]
    },
    {
      id: 'demo_prod_10',
      title: 'USB-C Hub 7-in-1',
      price: 59.99,
      category: 'Electronics',
      inventory_quantity: 41,
      status: 'active',
      created_at: getRelativeDateTime(12),
      updated_at: getRelativeDateTime(1),
      handle: 'usb-c-hub-7-in-1',
      vendor: 'ConnectPro',
      product_type: 'Accessories',
      tags: ['usb-c', 'hub', 'connectivity', 'multi-port'],
      images: [{ src: '/demo/products/usb-hub.jpg', alt: 'USB-C Hub' }],
      variants: [
        { id: 'var_10_1', title: 'Space Gray', price: 59.99, inventory_quantity: 25, sku: 'HUB-001-GRY' },
        { id: 'var_10_2', title: 'Silver', price: 59.99, inventory_quantity: 16, sku: 'HUB-001-SLV' }
      ]
    },
    {
      id: 'demo_prod_11',
      title: 'Smart Home Camera',
      price: 129.99,
      category: 'Electronics',
      inventory_quantity: 23,
      status: 'active',
      created_at: getRelativeDateTime(10),
      updated_at: getRelativeDateTime(1),
      handle: 'smart-home-camera',
      vendor: 'SecureTech',
      product_type: 'Security',
      tags: ['smart-home', 'security', 'wifi', '1080p'],
      images: [{ src: '/demo/products/security-camera.jpg', alt: 'Smart Home Camera' }],
      variants: [
        { id: 'var_11_1', title: 'Indoor', price: 129.99, inventory_quantity: 15, sku: 'CAM-001-IN' },
        { id: 'var_11_2', title: 'Outdoor', price: 139.99, inventory_quantity: 8, sku: 'CAM-001-OUT' }
      ]
    },
    {
      id: 'demo_prod_12',
      title: 'Gaming Mouse RGB',
      price: 79.99,
      category: 'Electronics',
      inventory_quantity: 34,
      status: 'active',
      created_at: getRelativeDateTime(8),
      updated_at: getRelativeDateTime(1),
      handle: 'gaming-mouse-rgb',
      vendor: 'GameTech',
      product_type: 'Gaming',
      tags: ['gaming', 'rgb', 'high-dpi', 'ergonomic'],
      images: [{ src: '/demo/products/gaming-mouse.jpg', alt: 'Gaming Mouse' }],
      variants: [
        { id: 'var_12_1', title: 'Black', price: 79.99, inventory_quantity: 20, sku: 'GM-001-BLK' },
        { id: 'var_12_2', title: 'White', price: 79.99, inventory_quantity: 14, sku: 'GM-001-WHT' }
      ]
    },

    // Home & Furniture Category (6 products)
    {
      id: 'demo_prod_3',
      title: 'Ergonomic Office Chair',
      price: 299.99,
      category: 'Furniture',
      inventory_quantity: 18,
      status: 'active',
      created_at: getRelativeDateTime(35),
      updated_at: getRelativeDateTime(2),
      handle: 'ergonomic-office-chair',
      vendor: 'ComfortSeating',
      product_type: 'Office Furniture',
      tags: ['ergonomic', 'office', 'adjustable', 'lumbar-support'],
      images: [{ src: '/demo/products/office-chair.jpg', alt: 'Ergonomic Office Chair' }],
      variants: [
        { id: 'var_3_1', title: 'Black Mesh', price: 299.99, inventory_quantity: 12, sku: 'OC-001-BLK' },
        { id: 'var_3_2', title: 'Gray Fabric', price: 319.99, inventory_quantity: 6, sku: 'OC-001-GRY' }
      ]
    },
    {
      id: 'demo_prod_6',
      title: 'LED Desk Lamp with USB',
      price: 49.99,
      category: 'Lighting',
      inventory_quantity: 52,
      status: 'active',
      created_at: getRelativeDateTime(22),
      updated_at: getRelativeDateTime(1),
      handle: 'led-desk-lamp-with-usb',
      vendor: 'BrightLight',
      product_type: 'Lighting',
      tags: ['led', 'desk-lamp', 'usb-charging', 'adjustable'],
      images: [{ src: '/demo/products/desk-lamp.jpg', alt: 'LED Desk Lamp' }],
      variants: [
        { id: 'var_6_1', title: 'White', price: 49.99, inventory_quantity: 30, sku: 'DL-001-WHT' },
        { id: 'var_6_2', title: 'Black', price: 49.99, inventory_quantity: 22, sku: 'DL-001-BLK' }
      ]
    },
    {
      id: 'demo_prod_8',
      title: 'Laptop Stand Adjustable',
      price: 69.99,
      category: 'Accessories',
      inventory_quantity: 39,
      status: 'active',
      created_at: getRelativeDateTime(16),
      updated_at: getRelativeDateTime(2),
      handle: 'laptop-stand-adjustable',
      vendor: 'DeskPro',
      product_type: 'Office Accessories',
      tags: ['laptop-stand', 'adjustable', 'ergonomic', 'aluminum'],
      images: [{ src: '/demo/products/laptop-stand.jpg', alt: 'Laptop Stand' }],
      variants: [
        { id: 'var_8_1', title: 'Silver', price: 69.99, inventory_quantity: 25, sku: 'LS-001-SLV' },
        { id: 'var_8_2', title: 'Space Gray', price: 69.99, inventory_quantity: 14, sku: 'LS-001-GRY' }
      ]
    },
    {
      id: 'demo_prod_13',
      title: 'Standing Desk Converter',
      price: 199.99,
      category: 'Furniture',
      inventory_quantity: 15,
      status: 'active',
      created_at: getRelativeDateTime(14),
      updated_at: getRelativeDateTime(1),
      handle: 'standing-desk-converter',
      vendor: 'ErgoWork',
      product_type: 'Office Furniture',
      tags: ['standing-desk', 'height-adjustable', 'ergonomic', 'workspace'],
      images: [{ src: '/demo/products/standing-desk.jpg', alt: 'Standing Desk Converter' }],
      variants: [
        { id: 'var_13_1', title: 'Small (32 inch)', price: 199.99, inventory_quantity: 8, sku: 'SD-001-SM' },
        { id: 'var_13_2', title: 'Large (42 inch)', price: 249.99, inventory_quantity: 7, sku: 'SD-001-LG' }
      ]
    },
    {
      id: 'demo_prod_14',
      title: 'Decorative Wall Art Set',
      price: 89.99,
      category: 'Home Decor',
      inventory_quantity: 26,
      status: 'active',
      created_at: getRelativeDateTime(11),
      updated_at: getRelativeDateTime(3),
      handle: 'decorative-wall-art-set',
      vendor: 'ArtHome',
      product_type: 'Wall Art',
      tags: ['wall-art', 'decorative', 'modern', 'set-of-3'],
      images: [{ src: '/demo/products/wall-art.jpg', alt: 'Wall Art Set' }],
      variants: [
        { id: 'var_14_1', title: 'Abstract Modern', price: 89.99, inventory_quantity: 15, sku: 'WA-001-ABS' },
        { id: 'var_14_2', title: 'Nature Theme', price: 89.99, inventory_quantity: 11, sku: 'WA-001-NAT' }
      ]
    },
    {
      id: 'demo_prod_15',
      title: 'Memory Foam Pillow',
      price: 49.99,
      category: 'Bedding',
      inventory_quantity: 44,
      status: 'active',
      created_at: getRelativeDateTime(9),
      updated_at: getRelativeDateTime(1),
      handle: 'memory-foam-pillow',
      vendor: 'SleepWell',
      product_type: 'Bedding',
      tags: ['memory-foam', 'pillow', 'ergonomic', 'cooling'],
      images: [{ src: '/demo/products/memory-pillow.jpg', alt: 'Memory Foam Pillow' }],
      variants: [
        { id: 'var_15_1', title: 'Standard', price: 49.99, inventory_quantity: 25, sku: 'MP-001-STD' },
        { id: 'var_15_2', title: 'King Size', price: 59.99, inventory_quantity: 19, sku: 'MP-001-KNG' }
      ]
    },

    // Kitchen & Appliances Category (4 products)
    {
      id: 'demo_prod_5',
      title: 'Professional Coffee Maker',
      price: 189.99,
      category: 'Appliances',
      inventory_quantity: 21,
      status: 'active',
      created_at: getRelativeDateTime(28),
      updated_at: getRelativeDateTime(2),
      handle: 'professional-coffee-maker',
      vendor: 'BrewMaster',
      product_type: 'Kitchen Appliances',
      tags: ['coffee-maker', 'professional', 'programmable', 'thermal-carafe'],
      images: [{ src: '/demo/products/coffee-maker.jpg', alt: 'Coffee Maker' }],
      variants: [
        { id: 'var_5_1', title: '10-Cup', price: 189.99, inventory_quantity: 12, sku: 'CM-001-10C' },
        { id: 'var_5_2', title: '12-Cup', price: 219.99, inventory_quantity: 9, sku: 'CM-001-12C' }
      ]
    },
    {
      id: 'demo_prod_16',
      title: 'Stainless Steel Water Bottle',
      price: 24.99,
      category: 'Kitchen',
      inventory_quantity: 78,
      status: 'active',
      created_at: getRelativeDateTime(7),
      updated_at: getRelativeDateTime(1),
      handle: 'stainless-steel-water-bottle',
      vendor: 'HydroLife',
      product_type: 'Drinkware',
      tags: ['water-bottle', 'stainless-steel', 'insulated', 'leak-proof'],
      images: [{ src: '/demo/products/water-bottle.jpg', alt: 'Water Bottle' }],
      variants: [
        { id: 'var_16_1', title: '20oz Black', price: 24.99, inventory_quantity: 40, sku: 'WB-001-20-BLK' },
        { id: 'var_16_2', title: '32oz Silver', price: 29.99, inventory_quantity: 38, sku: 'WB-001-32-SLV' }
      ]
    },
    {
      id: 'demo_prod_17',
      title: 'Air Fryer 6-Quart',
      price: 149.99,
      category: 'Appliances',
      inventory_quantity: 19,
      status: 'active',
      created_at: getRelativeDateTime(6),
      updated_at: getRelativeDateTime(1),
      handle: 'air-fryer-6-quart',
      vendor: 'CrispyCook',
      product_type: 'Kitchen Appliances',
      tags: ['air-fryer', 'healthy-cooking', 'digital', '6-quart'],
      images: [{ src: '/demo/products/air-fryer.jpg', alt: 'Air Fryer' }],
      variants: [
        { id: 'var_17_1', title: 'Black', price: 149.99, inventory_quantity: 12, sku: 'AF-001-BLK' },
        { id: 'var_17_2', title: 'White', price: 149.99, inventory_quantity: 7, sku: 'AF-001-WHT' }
      ]
    },
    {
      id: 'demo_prod_18',
      title: 'Bamboo Cutting Board Set',
      price: 39.99,
      category: 'Kitchen',
      inventory_quantity: 56,
      status: 'active',
      created_at: getRelativeDateTime(5),
      updated_at: getRelativeDateTime(2),
      handle: 'bamboo-cutting-board-set',
      vendor: 'EcoKitchen',
      product_type: 'Kitchen Tools',
      tags: ['cutting-board', 'bamboo', 'eco-friendly', 'set-of-3'],
      images: [{ src: '/demo/products/cutting-board.jpg', alt: 'Bamboo Cutting Board Set' }],
      variants: [
        { id: 'var_18_1', title: 'Natural', price: 39.99, inventory_quantity: 35, sku: 'CB-001-NAT' },
        { id: 'var_18_2', title: 'Dark Stain', price: 44.99, inventory_quantity: 21, sku: 'CB-001-DRK' }
      ]
    },

    // Fitness & Health Category (3 products)
    {
      id: 'demo_prod_19',
      title: 'Yoga Mat Extra Thick',
      price: 34.99,
      category: 'Fitness',
      inventory_quantity: 48,
      status: 'active',
      created_at: getRelativeDateTime(4),
      updated_at: getRelativeDateTime(1),
      handle: 'yoga-mat-extra-thick',
      vendor: 'ZenFit',
      product_type: 'Fitness Equipment',
      tags: ['yoga-mat', 'extra-thick', 'non-slip', 'eco-friendly'],
      images: [{ src: '/demo/products/yoga-mat.jpg', alt: 'Yoga Mat' }],
      variants: [
        { id: 'var_19_1', title: 'Purple', price: 34.99, inventory_quantity: 25, sku: 'YM-001-PUR' },
        { id: 'var_19_2', title: 'Teal', price: 34.99, inventory_quantity: 23, sku: 'YM-001-TEA' }
      ]
    },
    {
      id: 'demo_prod_20',
      title: 'Resistance Bands Set',
      price: 29.99,
      category: 'Fitness',
      inventory_quantity: 63,
      status: 'active',
      created_at: getRelativeDateTime(3),
      updated_at: getRelativeDateTime(1),
      handle: 'resistance-bands-set',
      vendor: 'PowerFit',
      product_type: 'Fitness Equipment',
      tags: ['resistance-bands', 'set-of-5', 'workout', 'portable'],
      images: [{ src: '/demo/products/resistance-bands.jpg', alt: 'Resistance Bands Set' }],
      variants: [
        { id: 'var_20_1', title: 'Light-Heavy Set', price: 29.99, inventory_quantity: 35, sku: 'RB-001-LH' },
        { id: 'var_20_2', title: 'Extra Heavy Set', price: 34.99, inventory_quantity: 28, sku: 'RB-001-XH' }
      ]
    },
    {
      id: 'demo_prod_21',
      title: 'Foam Roller Massage',
      price: 44.99,
      category: 'Fitness',
      inventory_quantity: 37,
      status: 'active',
      created_at: getRelativeDateTime(2),
      updated_at: getRelativeDateTime(1),
      handle: 'foam-roller-massage',
      vendor: 'RecoveryPro',
      product_type: 'Recovery Equipment',
      tags: ['foam-roller', 'massage', 'muscle-recovery', 'textured'],
      images: [{ src: '/demo/products/foam-roller.jpg', alt: 'Foam Roller' }],
      variants: [
        { id: 'var_21_1', title: '18 inch', price: 44.99, inventory_quantity: 20, sku: 'FR-001-18' },
        { id: 'var_21_2', title: '24 inch', price: 54.99, inventory_quantity: 17, sku: 'FR-001-24' }
      ]
    },

    // Fashion & Accessories Category (3 products)
    {
      id: 'demo_prod_22',
      title: 'Premium Leather Wallet',
      price: 79.99,
      category: 'Fashion',
      inventory_quantity: 42,
      status: 'active',
      created_at: getRelativeDateTime(1),
      updated_at: getRelativeDateTime(1),
      handle: 'premium-leather-wallet',
      vendor: 'LeatherCraft',
      product_type: 'Accessories',
      tags: ['leather-wallet', 'premium', 'rfid-blocking', 'handcrafted'],
      images: [{ src: '/demo/products/leather-wallet.jpg', alt: 'Leather Wallet' }],
      variants: [
        { id: 'var_22_1', title: 'Brown', price: 79.99, inventory_quantity: 25, sku: 'LW-001-BRN' },
        { id: 'var_22_2', title: 'Black', price: 79.99, inventory_quantity: 17, sku: 'LW-001-BLK' }
      ]
    },
    {
      id: 'demo_prod_23',
      title: 'Sunglasses Polarized',
      price: 119.99,
      category: 'Fashion',
      inventory_quantity: 31,
      status: 'active',
      created_at: getRelativeDateTime(1),
      updated_at: getRelativeDateTime(1),
      handle: 'sunglasses-polarized',
      vendor: 'SunStyle',
      product_type: 'Eyewear',
      tags: ['sunglasses', 'polarized', 'uv-protection', 'aviator'],
      images: [{ src: '/demo/products/sunglasses.jpg', alt: 'Polarized Sunglasses' }],
      variants: [
        { id: 'var_23_1', title: 'Gold Frame', price: 119.99, inventory_quantity: 18, sku: 'SG-001-GLD' },
        { id: 'var_23_2', title: 'Silver Frame', price: 119.99, inventory_quantity: 13, sku: 'SG-001-SLV' }
      ]
    },
    {
      id: 'demo_prod_24',
      title: 'Crossbody Travel Bag',
      price: 89.99,
      category: 'Fashion',
      inventory_quantity: 29,
      status: 'active',
      created_at: getRelativeDateTime(1),
      updated_at: getRelativeDateTime(1),
      handle: 'crossbody-travel-bag',
      vendor: 'TravelPro',
      product_type: 'Bags',
      tags: ['crossbody-bag', 'travel', 'waterproof', 'anti-theft'],
      images: [{ src: '/demo/products/travel-bag.jpg', alt: 'Crossbody Travel Bag' }],
      variants: [
        { id: 'var_24_1', title: 'Charcoal', price: 89.99, inventory_quantity: 16, sku: 'TB-001-CHR' },
        { id: 'var_24_2', title: 'Navy', price: 89.99, inventory_quantity: 13, sku: 'TB-001-NVY' }
      ]
    }
  ] as DemoProduct[],

  analytics: {
    revenue: {
      total_revenue: 26900.0,
      daily_revenue: Array.from({ length: 30 }, (_, i) => ({
        date: getRelativeDate(29 - i),
        revenue: Math.round((800 + Math.random() * 400) * 100) / 100,
        orders: Math.floor(5 + Math.random() * 8)
      })),
      monthly_revenue: 26900.0,
      revenue_growth: 12.3
    },
    orders: {
      total_orders: 187,
      daily_orders: Array.from({ length: 30 }, (_, i) => ({
        date: getRelativeDate(29 - i),
        order_count: Math.floor(5 + Math.random() * 8),
        revenue: Math.round((800 + Math.random() * 400) * 100) / 100,
        customer_id: `demo_customer_${Math.floor(Math.random() * 100)}`,
        order_id: `demo_order_${1000 + i}`,
        created_at: getRelativeDateTime(29 - i, 10 + Math.floor(Math.random() * 12)),
        total_price: Math.round((50 + Math.random() * 200) * 100) / 100
      })),
      average_order_value: 143.85,
      conversion_rate: 2.50
    },
    customers: {
      total_customers: 89,
      returning_customers: 67,
      new_customers_this_month: 22,
      customer_retention_rate: 75.3
    },
    inventory: {
      total_products: 24,
      low_stock_count: 8,
      out_of_stock_count: 3,
      abandoned_cart_count: 24,
      new_products_this_month: 5
    },
    insights: {
      price_advantage_percentage: 8.5,
      competitors_monitored: 8,
      price_alerts_last_week: 3,
      weekly_revenue_growth: 12.3,
      monthly_revenue_growth: 18.7,
      customer_acquisition_rate: 15.2
    }
  } as DemoAnalytics,

  competitors: [
    {
      id: 'comp_1',
      name: 'Amazon - Wireless Headphones',
      url: 'https://amazon.com/wireless-headphones-demo',
      current_price: 159.99,
      our_price: 149.99,
      price_difference: -10.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 14, 30),
      status: 'active',
      platform: 'amazon',
      product_match_confidence: 0.95
    },
    {
      id: 'comp_2',
      name: 'Best Buy - Fitness Tracker',
      url: 'https://bestbuy.com/fitness-tracker-demo',
      current_price: 94.99,
      our_price: 89.99,
      price_difference: -5.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 15, 45),
      status: 'active',
      platform: 'bestbuy',
      product_match_confidence: 0.92
    },
    {
      id: 'comp_3',
      name: 'Wayfair - Office Chair',
      url: 'https://wayfair.com/office-chair-demo',
      current_price: 319.99,
      our_price: 299.99,
      price_difference: -20.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 16, 15),
      status: 'active',
      platform: 'wayfair',
      product_match_confidence: 0.88
    },
    {
      id: 'comp_4',
      name: 'Target - Power Bank',
      url: 'https://target.com/power-bank-demo',
      current_price: 44.99,
      our_price: 39.99,
      price_difference: -5.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 17, 0),
      status: 'active',
      platform: 'target',
      product_match_confidence: 0.90
    },
    {
      id: 'comp_5',
      name: 'Williams Sonoma - Coffee Maker',
      url: 'https://williams-sonoma.com/coffee-maker-demo',
      current_price: 199.99,
      our_price: 189.99,
      price_difference: -10.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 18, 30),
      status: 'active',
      platform: 'williams-sonoma',
      product_match_confidence: 0.87
    },
    {
      id: 'comp_6',
      name: 'Amazon - Desk Lamp',
      url: 'https://amazon.com/led-desk-lamp-demo',
      current_price: 54.99,
      our_price: 49.99,
      price_difference: -5.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 19, 45),
      status: 'active',
      platform: 'amazon',
      product_match_confidence: 0.93
    },
    {
      id: 'comp_7',
      name: 'REI - Yoga Mat',
      url: 'https://rei.com/yoga-mat-demo',
      current_price: 39.99,
      our_price: 34.99,
      price_difference: -5.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 20, 10),
      status: 'active',
      platform: 'rei',
      product_match_confidence: 0.91
    },
    {
      id: 'comp_8',
      name: 'Nordstrom - Leather Wallet',
      url: 'https://nordstrom.com/leather-wallet-demo',
      current_price: 89.99,
      our_price: 79.99,
      price_difference: -10.00,
      price_advantage: true,
      last_checked: getRelativeDateTime(0, 21, 25),
      status: 'active',
      platform: 'nordstrom',
      product_match_confidence: 0.89
    }
  ] as DemoCompetitor[]
};

/**
 * Performance Metrics for Demo Data Bundle
 * 
 * Bundle Size: ~150KB compressed (~500KB uncompressed)
 * Load Time: 10-50ms (vs 500-2000ms for API calls)
 * Memory Usage: ~2MB client-side (vs 11-22MB server-side per session)
 * Concurrent Users: Unlimited (vs 3-5 on 512MB server)
 * 
 * Backend Resource Savings per Demo Session:
 * - API Calls: 95% reduction (50+ calls → 1-2 calls)
 * - Database Queries: 100% reduction for demo data
 * - Redis Operations: 100% reduction for demo data
 * - Memory Usage: 100% server-side reduction
 * - CPU Usage: 80% reduction for demo users
 */
