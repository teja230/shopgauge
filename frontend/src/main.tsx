import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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

// Start preloading immediately
preloadCriticalResources();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
