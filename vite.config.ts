import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Mode "single" : produit un unique fichier HTML autonome (aperçu partageable).
// Mode normal : application statique classique dans dist/.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  worker: { format: 'es' },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  server: { host: true },
}));
