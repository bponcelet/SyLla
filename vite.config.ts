import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Inline the logo into index.html so the loading screen paints before any script or font loads. */
const splashLogo = (): Plugin => ({
  name: 'splash-logo',
  transformIndexHtml: (html) => html.replace('<!--splash-logo-->', readFileSync('src/assets/logo.svg', 'utf8')),
});

export default defineConfig({
  plugins: [react(), splashLogo()],
  // Relative base so the build works inside the Capacitor WebView.
  base: './',
  // Listen on all addresses (IPv4 too): the Android emulator reaches the PC at 10.0.2.2 (IPv4),
  // and live reload on a real device goes over the local network.
  server: { host: true },
  test: {
    environment: 'jsdom',
  },
});
