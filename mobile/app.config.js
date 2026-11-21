// Extends app.json with values that differ per build. Expo passes the parsed
// app.json in as `config`.
//
// Build-time environment variables:
//   EXPO_PUBLIC_API_URL              Backend root URL, e.g. https://civicfix-api.onrender.com
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY  Optional. Enables the in-app map on Android.
//                                    Without it the app shows coordinates and an
//                                    "Open in Maps" link instead of crashing.
//   ANDROID_VERSION_CODE             Integer that must increase with every APK
//                                    you hand out, so phones accept it as an update.
module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE || '', 10);

  return {
    ...config,
    android: {
      ...config.android,
      ...(Number.isInteger(versionCode) && versionCode > 0 ? { versionCode } : {}),
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
  };
};
