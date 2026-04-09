import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.git/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer/src'),
      '@framework': path.resolve(__dirname, './src/renderer/WebSDK/Framework/src'),
      '@cubismsdksamples': path.resolve(__dirname, './src/renderer/WebSDK/src'),
    },
  },
});
