const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .tflite model files as binary assets
config.resolver.assetExts.push('tflite');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  'expo-keep-awake': path.resolve(__dirname, 'src/shims/expoKeepAwake.ts'),
};

// Web build only: native modules that have no browser implementation are
// swapped for browser-backed equivalents. iOS and Android are not affected.
const webShim = (file) => path.resolve(__dirname, 'src/web/shims', file);
const WEB_MODULE_ALIASES = {
  'expo-file-system': webShim('expoFileSystem.ts'),
  'expo-sqlite': webShim('expoSqlite.ts'),
  'expo-sharing': webShim('expoSharing.ts'),
  'expo-haptics': webShim('expoHaptics.ts'),
  'react-native-view-shot': webShim('viewShot.ts'),
  'react-native-webview': webShim('webview.tsx'),
  'react-native-fast-tflite': webShim('fastTflite.ts'),
  '@shopify/react-native-skia': webShim('skia.ts'),
  'react-native-audio-api': webShim('empty.ts'),
  'react-native-maps': webShim('empty.ts'),
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_MODULE_ALIASES[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_MODULE_ALIASES[moduleName] };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
