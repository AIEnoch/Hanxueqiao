import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/Hanxueqiao/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        about: 'about.html',
      },
    },
  },
})