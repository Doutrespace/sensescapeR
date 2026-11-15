export const Colors = {
  // Core backgrounds - warm neutral, inspired by editorial map interfaces
  background: '#F3EFE6',
  surface: '#FBF8F1',
  surfaceHighlight: '#D8D1C3',

  // Primary accent - keep the UI monochrome and let data pop
  primary: '#171717',
  primaryMuted: '#17171714',

  // Secondary accents
  secondary: '#7A725F',
  secondaryMuted: '#7A725F20',

  // Semantic colors
  success: '#3D7D5E',
  successMuted: '#3D7D5E20',
  warning: '#B9863D',
  warningMuted: '#B9863D1C',
  error: '#B55245',
  errorMuted: '#B552451A',

  // Text colors
  text: '#171717',
  textMuted: '#6E685D',
  textDisabled: '#A29B8F',

  // Sync status colors
  statusLocal: '#756F64',
  statusQueued: '#C59A4A',
  statusUploading: '#6C8AA7',
  statusUploaded: '#4E8A68',
  statusFailed: '#B55245',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 100,
};

export const Typography = {
  caption: 12,
  body: 15,
  bodyLarge: 17,
  subtitle: 18,
  title: 24,
  headline: 32,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  primary: {
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};
