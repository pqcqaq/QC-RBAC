import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import path from 'node:path';
import { pageRegistryPlugin } from './vite/page-registry';
import { themePresetsPlugin } from './vite/theme-presets';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', { '@/meta/page-definition': ['definePage'] }],
      resolvers: [ElementPlusResolver()],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css', directives: true })],
      dts: 'src/components.d.ts',
    }),
    pageRegistryPlugin(),
    themePresetsPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('element-plus')) {
            return 'vendor-element';
          }
          if (id.includes('socket.io-client')) {
            return 'vendor-socket';
          }
          if (id.includes('/pinia/') || id.includes('/vue-router/') || id.includes('/vue/')) {
            return 'vendor-vue';
          }
          return 'vendor-misc';
        },
      },
    },
  },
});
