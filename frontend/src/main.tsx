import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Performance optimization: Preload critical API endpoints
const preloadCriticalResources = () => {
  // Preload authentication check (most critical)
  if ('serviceWorker' in navigator) {
    // Use service worker for background preloading if available
    try {
      fetch('/api/auth/shopify/me', { 
        method: 'HEAD',
        credentials: 'include',
        cache: 'no-cache'
      }).catch(() => {
        // Silently ignore preload failures
        console.log('Auth preload failed - normal for unauthenticated users');
      });
    } catch (error) {
      // Ignore preload errors
    }
  }
};

// Start preloading immediately
preloadCriticalResources();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
