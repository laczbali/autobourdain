const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// getDefaultConfig detects the npm workspace root on its own, so the shared
// package resolves without extra watchFolders wiring.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
