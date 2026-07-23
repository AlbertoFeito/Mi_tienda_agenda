import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mitienda.app',
  appName: 'Mi Tienda',
  webDir: 'dist',
  android: {
    // Fully offline, single-user app — no cleartext HTTP traffic needed.
    allowMixedContent: false,
  },
  plugins: {
    CapacitorSQLite: {
      // Local, unencrypted on-device database. No network, no cloud.
      androidIsEncryption: false,
    },
  },
};

export default config;
