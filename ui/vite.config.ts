import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import ui from '@fisherrjd/ui/vite'

// one port per app — pick a unique one when cloning the template
const PORT = 3041

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    // Jade's theme, Grand Exchange gold: try other looks in /styleguide's
    // theme lab (dev only) and paste its config here
    ui({
      palette: 'gold',
      fonts: { heading: 'Cascadia Code', mono: 'Cascadia Code' },
      style: 'hud',
      radius: 2,
    }),
  ],
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
