import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || 'Calculator';

  if (mode === 'production' && env.VITE_DEV_UNLOCK_CODE) {
    throw new Error(
      'VITE_DEV_UNLOCK_CODE must not be set for production builds. Remove it from your production environment.'
    );
  }

  // GitHub Pages serves project sites under /<repo>/, not /. This app has a
  // single route (no client-side router), so a base path is a safe, purely
  // cosmetic change — nothing depends on paths being root-relative.
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // No push/notification workbox modules are referenced anywhere in this app.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          // App shell only — chat data/media are never precached.
          navigateFallbackDenylist: [/^\/api\//],
        },
        manifest: {
          name: appName,
          short_name: appName,
          description: 'A simple, fast calculator.',
          theme_color: '#1c1c1e',
          background_color: '#1c1c1e',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[hash].js',
          chunkFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash][extname]',
        },
      },
    },
  };
});
