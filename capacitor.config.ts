import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.syllalire.reader',
  appName: 'SyllaLire',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Normally hidden earlier by the web app (src/splash.ts) once the identical HTML loading screen
      // is painted; the timeout only matters if the web app fails to load (never stuck on the logo).
      launchAutoHide: true,
      launchShowDuration: 3000,
      backgroundColor: '#fbf5e9',
      showSpinner: false,
    },
  },
};

export default config;
