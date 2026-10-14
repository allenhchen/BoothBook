import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig({
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: root + 'standalone/server.ts',
    target: 'node22',
    outDir: root + 'dist-local',
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'server.mjs' } },
  },
});
