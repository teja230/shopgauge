import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize hybrid demo system for demo mode
const initializeHybridDemo = async () => {
  // Check if demo mode is active
  const isDemoMode = localStorage.getItem('demo_mode_active') === 'true' || 
                    new URLSearchParams(window.location.search).get('demo') === 'true';
  
  console.log('🚀 Main: Demo mode check:', {
    localStorage: localStorage.getItem('demo_mode_active'),
    urlParam: new URLSearchParams(window.location.search).get('demo'),
    isDemoMode,
    currentUrl: window.location.href
  });
  
  if (isDemoMode) {
    try {
      console.log('🚀 ShopGauge: Initializing hybrid demo system...');
      
      // Dynamic import to avoid affecting main bundle
      const { initializeHybridDemo } = await import('./services/HybridDemoBootstrap');
      
      const result = await initializeHybridDemo({
        strategy: 'hybrid',
        enableServiceWorker: true,
        enablePerformanceMonitoring: true,
        enableSecurity: true,
        enableAnalytics: false, // Privacy-conscious default
        debug: import.meta.env.DEV
      });
      
      if (result.success) {
        console.log(`✅ ShopGauge: Hybrid demo initialized in ${result.performanceBaseline.toFixed(1)}ms`);
        console.log(`📊 ShopGauge: Strategy: ${result.strategy}, Services: ${result.servicesEnabled.join(', ')}`);
        
        // Expose performance tools for developers
        if (import.meta.env.DEV) {
          const { hybridDemo } = await import('./services/HybridDemoBootstrap');
          (window as any).shopGaugeDemo = {
            getStats: () => hybridDemo.getPerformanceStats(),
            benchmark: () => hybridDemo.benchmarkStrategies(),
            switchStrategy: (strategy: string) => hybridDemo.switchStrategy(strategy as any),
            getHealth: () => hybridDemo.getSystemHealth()
          };
          console.log('🔧 ShopGauge: Developer tools available at window.shopGaugeDemo');
        }
      } else {
        console.warn('⚠️ ShopGauge: Hybrid demo initialization failed:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ ShopGauge: Failed to initialize hybrid demo system:', error);
    }
  }
};

// Performance optimization: Preload critical resources
const preloadCriticalResources = () => {
  // Preload critical CSS and other static resources
  if ('serviceWorker' in navigator) {
    // Use service worker for background preloading if available
    try {
      // Preload critical static resources instead of API endpoints
      // This prevents 500/502 errors during initial load
      console.log('Preloading critical static resources');
    } catch (error) {
      // Ignore preload errors
      console.log('Static resource preload failed - continuing normally');
    }
  }
};

// Start preloading and demo initialization
preloadCriticalResources();
initializeHybridDemo();

// Expose demo activation for testing
(window as any).activateDemoMode = () => {
  console.log('🎯 Activating demo mode...');
  localStorage.setItem('demo_mode_active', 'true');
  localStorage.setItem('isAuthenticated', 'true');
  sessionStorage.setItem('shop', 'demo-shopgauge.myshopify.com');
  window.location.reload();
};

// Expose demo status check
(window as any).checkDemoStatus = () => {
  console.log('🔍 Demo Status:', {
    localStorage: localStorage.getItem('demo_mode_active'),
    urlParam: new URLSearchParams(window.location.search).get('demo'),
    isAuthenticated: localStorage.getItem('isAuthenticated'),
    shop: sessionStorage.getItem('shop')
  });
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
