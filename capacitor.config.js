/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.sinseongo.app',
  appName: '신선고',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

module.exports = config;
