import { defineConfig } from 'vite';

export default defineConfig({
  base: '/PolygonHandCannon/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  }
});