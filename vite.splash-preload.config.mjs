import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build',
    lib: {
      entry: 'src/preload/splash-preload.js',
      formats: ['cjs'],
      fileName: () => 'splash-preload.js'
    },
    rollupOptions: {
      external: ['electron']
    },
    minify: false
  }
});
