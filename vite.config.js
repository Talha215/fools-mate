import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// The Cloudflare plugin runs worker/index.js inside the real Workers runtime
// (with a local D1 database) during `vite dev`, so dev matches production.
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { port: 5180 },
});
