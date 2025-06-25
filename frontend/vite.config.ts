import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Custom plugin to simulate _redirects behavior in development
const redirectsPlugin = () => {
  return {
    name: 'redirects-dev',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';
        
        // Routes that should serve loading.html (simulating _redirects file)
        const loadingRoutes = ['/dashboard', '/competitors', '/admin', '/profile', '/privacy-policy', '/test-loading'];
        
        if (loadingRoutes.includes(url)) {
          try {
            const loadingHtml = readFileSync(resolve(__dirname, 'public/loading.html'), 'utf-8');
            res.setHeader('Content-Type', 'text/html');
            res.end(loadingHtml);
            return;
          } catch (err) {
            console.error('Error serving loading.html:', err);
          }
        }
        
        next();
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
