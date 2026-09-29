import { defineConfig } from 'vite';
// main.ts uses top-level await on app.init(), which lazily imports Pixi renderer chunks. Those chunks must not import
// from the entry chunk or the module graph deadlocks, so all dependencies live in a separate vendor chunk.
export default defineConfig({ root: 'apps/web-client', server: { port: 5173, strictPort: true, proxy: { '/socket': { target: 'ws://127.0.0.1:3001', ws: true }, '/health': 'http://127.0.0.1:3001' } }, build: { outDir: '../../dist/client', emptyOutDir: true, rollupOptions: { output: { manualChunks: id => id.includes('node_modules') ? 'vendor' : undefined } } } });
