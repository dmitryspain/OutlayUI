import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native iOS shell around the same Angular build (`npm run ios:sync` builds the `mobile` configuration into webDir).
 * `server.iosScheme` stays at its default `capacitor`: the backend CORS list allows the origin `capacitor://localhost`.
 */
const config: CapacitorConfig = {
  appId: 'io.github.dmitryspain.outlay',
  appName: 'Outlay',
  webDir: 'dist/outlay-ui',
  ios: {
    // The web layout handles safe areas itself via CSS env(safe-area-inset-*), so the web view adds no insets.
    contentInset: 'never',
  },
};

export default config;
