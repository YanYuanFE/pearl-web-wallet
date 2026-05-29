import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// /rpc 代理到公共 Pearl 节点（dev：服务端转发，绕开 CORS；不携带任何密钥）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/rpc': {
        target: 'https://rpc.pearlwallet.xyz',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/rpc/, '/'),
      },
    },
  },
})
