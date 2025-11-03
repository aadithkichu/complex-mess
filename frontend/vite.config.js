import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';

const BACKEND_PORT = 5001;
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss() ,  VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Complex',
        short_name: 'Complx',
        description: 'A modern PWA built with React and Vite',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })],
  server: {
    // This setting tells Vite to proxy requests starting with /api
    proxy: {
      '/api': {
        // Change this target URL to your actual backend server address
        target: `http://localhost:${BACKEND_PORT}`, 
        changeOrigin: true, // Needed for virtual hosting
        secure: false,      // Use true if your backend uses HTTPS
      },
    },
  },
})
