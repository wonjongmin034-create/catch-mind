import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로로 빌드 → GitHub Pages 어느 경로에 올려도 동작
  base: './',
  plugins: [react()],
  server: {
    host: true, // 같은 와이파이의 태블릿에서 접속 가능
  },
})
