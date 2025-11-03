import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
const BACKEND_PORT = 5001;
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
