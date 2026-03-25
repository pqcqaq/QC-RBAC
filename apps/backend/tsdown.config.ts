import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'src/main': './src/main.ts',
  },
  format: 'esm',
  outDir: 'dist',
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: true,
  treeshake: true,
  dts: false,
  minify: false,
  deps: {
    alwaysBundle: ['@rbac/api-common'],
  },
});
