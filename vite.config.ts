import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base: '/oyun/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Ana giriş dosyası istenen "app.v1.0.0.js" biçimini birebir kullanır.
        // Chunk ve asset'lerde ise aynı isimli farklı modüllerin (ör. birden
        // fazla lazy-loaded "index" chunk'ı) üzerine yazmasını önlemek için
        // sürüm etiketinin yanında kısa bir hash de tutulur — böylece hem
        // "sürümlenebilir dosya adı" isteği karşılanır hem de içerik
        // değiştiğinde önbellek güvenle geçersiz kılınır.
        entryFileNames: `[name].v${version}.js`,
        chunkFileNames: `[name]-[hash].v${version}.js`,
        assetFileNames: `[name]-[hash].v${version}.[ext]`,
      },
    },
  },
});
