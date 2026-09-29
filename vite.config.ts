import { defineConfig } from 'vite';
export default defineConfig({ root: 'apps/web-client', server: { port: 5173, strictPort: true, proxy: { '/socket': { target: 'ws://127.0.0.1:3001', ws: true }, '/health': 'http://127.0.0.1:3001' } }, build: { outDir: '../../dist/client', emptyOutDir: true } });
