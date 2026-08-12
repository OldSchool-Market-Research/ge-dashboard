import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// one port per app — pick a unique one when cloning the template
const PORT = 3040

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: './dist',
  },
  preview: {
    port: PORT,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: PORT,
    // dev talks straight to the orchestrator (in prod the Go server
    // reverse-proxies /api on the same origin, incl. SSE)
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND ?? 'http://10.43.208.143:8410',
        changeOrigin: true,
      },
    },
  },
})
