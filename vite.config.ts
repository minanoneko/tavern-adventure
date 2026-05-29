import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'cache-bust',
      transformIndexHtml() {
        return [{
          tag: 'meta',
          attrs: { 'build-time': Date.now().toString() },
        }];
      },
    },
  ],
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
})
