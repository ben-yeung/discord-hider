import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-extension-assets',
      closeBundle() {
        copyFileSync('manifest.json', 'dist/manifest.json')
        mkdirSync('dist/icons', { recursive: true })
        for (const size of [16, 32, 48, 128]) {
          copyFileSync(`src/assets/icon${size}.png`, `dist/icons/icon${size}.png`)
        }
        mkdirSync('dist/assets/sounds', { recursive: true })
        for (const file of readdirSync('src/assets/sounds')) {
          if (file.endsWith('.mp3')) copyFileSync(`src/assets/sounds/${file}`, `dist/assets/sounds/${file}`)
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
