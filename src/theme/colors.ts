/**
 * One calm colour system for the whole app:
 * - neutrals for backgrounds, cards and lines,
 * - ink for text and the main buttons,
 * - one accent (petrol) for app-wide selections, progress, scales and icons,
 * - TopicColors: one cool pastel per questionnaire topic (senses pages,
 *   project groups),
 * - muted data colours (DataColors) only where colour carries meaning.
 * Avoid introducing new hues in components; use these tokens.
 */
export const Colors = {
  // Core backgrounds: warm off-white page, white cards, fine lines
  background: '#F5F3EE',
  surface: '#FFFFFF',
  surfaceSubtle: '#F2EFE9',
  surfaceHighlight: '#E3DED4',

  // Ink: text and main buttons
  primary: '#16191D',
  primaryMuted: '#16191D14',

  // The one accent colour
  accent: '#2D5C68',
  accentSoft: '#E4EDEE',
  accentMuted: '#2D5C681F',

  // Secondary accents
  secondary: '#7A725F',
  secondaryMuted: '#7A725F20',

  // Semantic colors
  success: '#2F7556',
  successMuted: '#2F755620',
  warning: '#A8741F',
  warningMuted: '#A8741F1C',
  error: '#B0463A',
  errorMuted: '#B0463A1A',

  // Text colors
  text: '#16191D',
  textMuted: '#625E57',
  textDisabled: '#A59F95',

  // Sync status colors
  statusLocal: '#77726A',
  statusQueued: '#A8741F',
  statusUploading: '#4F6F86',
  statusUploaded: '#2F7556',
  statusFailed: '#B0463A',
};

export interface TopicColor {
  /** Icons, text and selected states; carries white text (about 6:1). */
  color: string;
  /** Pastel fill for hero areas and icon tiles. */
  soft: string;
}

/**
 * Cool pastels, one per questionnaire topic. All share one lightness and a
 * low chroma (OKLCH: soft L 0.95 / C 0.021, color L 0.50 / C 0.068), so the
 * topics differ in hue only and none of them shouts.
 */
export const TopicColors = {
  sage: { color: '#446F50', soft: '#E5F3E8' },
  seafoam: { color: '#2C706C', soft: '#E0F4F2' },
  glacier: { color: '#316C7F', soft: '#E1F3F9' },
  mist: { color: '#486589', soft: '#E6F0FD' },
  periwinkle: { color: '#5E5E89', soft: '#EDEEFD' },
  lavender: { color: '#705880', soft: '#F4EBFA' },
  heather: { color: '#815369', soft: '#FBEAF1' },
};

/** Muted colours for data (categories, map markers, charts); not for UI chrome. */
export const DataColors = {
  slate: '#4F6F86',
  sage: '#5E8068',
  sand: '#B0956A',
  clay: '#A4664F',
  plum: '#76658A',
  stone: '#7A756C',
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
