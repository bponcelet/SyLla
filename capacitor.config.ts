import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.syllalire.reader',
  appName: 'SyllaLire',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Hidden from the web app (src/splash.ts) once the identical HTML loading screen is painted.
      launchAutoHide: false,
      backgroundColor: '#fbf5e9',
      showSpinner: false,
    },
  },
};

export default config;
