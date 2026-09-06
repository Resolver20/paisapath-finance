import { defineConfig } from 'vite';

export default defineConfig({
  base: '/paisapath-finance/',
  build: {
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  plugins: [{
    name: 'classic-browser-script',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace('type="module" crossorigin', 'defer'),
    },
  }],
});
