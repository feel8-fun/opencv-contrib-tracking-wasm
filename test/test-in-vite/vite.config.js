import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    // Force Vite to pre-bundle your CJS package
    exclude: ['@feel8.fun/opencv-contrib-tracking-wasm']
  },
  
  server: {
    fs: {
      // Allow serving files from parent directories (for npm link)
      allow: ['..']
    },
    force: true
  },
  build: {
    // Ensure CJS dependencies are handled in build
    commonjsOptions: {
      include: [/@feel8.fun\/opencv-contrib-tracking-wasm/, /node_modules/]
    }
  }
})