import {defineConfig} from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Wails dev proxy dials 127.0.0.1; "localhost" resolves to ::1 on macOS.
  server: {
    host: '127.0.0.1'
  },
  build: {
    target: 'esnext'
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
})
