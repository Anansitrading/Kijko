import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'https://3001-iaxx0o3ruogtmyukx6kam-6532622b.e2b.dev',
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      },
      '/ws': {
        target: 'wss://3001-iaxx0o3ruogtmyukx6kam-6532622b.e2b.dev',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:3001')
  }
})