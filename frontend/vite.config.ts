import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Custom plugin to handle SPA routing in development
// In production, _redirects file handles this behavior
const redirectsPlugin = () => {
  return {
    name: 'spa-fallback',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';
        
        // Only handle exact route matches, not partial matches or query parameters
        const cleanUrl = url.split('?')[0]; // Remove query parameters
        
        // Skip API routes, static assets, and development files
        if (cleanUrl.startsWith('/api') || 
            cleanUrl.startsWith('/@') || 
            cleanUrl.includes('.') ||
            cleanUrl === '/') {
          next();
          return;
        }
        
        console.log(`[SPA Fallback] Serving index.html for route: ${cleanUrl}`);
        
        // For all other routes, serve the main index.html to let React Router handle routing
        try {
          const indexHtml = readFileSync(resolve(__dirname, 'index.html'), 'utf-8');
          res.setHeader('Content-Type', 'text/html');
          res.end(indexHtml);
          return;
        } catch (err) {
          console.error('Error serving index.html:', err);
          next();
        }
      });
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), redirectsPlugin()],
  build: {
    // Reduce bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@mui/material', '@mui/icons-material'],
          utils: ['axios', 'date-fns'],
        },
        // Add cache busting with timestamp
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return 'assets/[name]-[hash].[ext]';
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css|js)$/.test(assetInfo.name)) {
            return `assets/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    // Reduce build size
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  // Ensure static files in public directory are served correctly
  publicDir: 'public',
})
