/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.ohnang.app',
  appName: '오냥',
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
