/**
 * Flyer to Table — design tokens.
 * Green/white theme per the web UX mockups: cream canvas, dark-green sidebar,
 * green accents, white cards.
 */

export const colors = {
  // Brand greens
  brand: '#2E7D32', // primary action green
  brandDark: '#256428',
  brandLight: '#4A9B5E',

  // Sidebar (dark green)
  sidebar: '#2E4B3C',
  sidebarActive: '#3C5E4B',
  sidebarText: '#DDE6DE',
  sidebarTextMuted: '#9DB0A2',

  // Surfaces
  canvas: '#F5F3EE', // app background (cream)
  surface: '#FFFFFF', // cards
  surfaceMuted: '#EFEDE6',
  surfaceSunken: '#F2F0EA',

  // Text
  text: '#1F2A24',
  textMuted: '#6B7770',
  textFaint: '#9AA39D',
  onBrand: '#FFFFFF',

  // Feedback
  success: '#2E7D32',
  successBg: '#E7F3E9',
  danger: '#C0392B',
  dangerBg: '#FBEAE8',
  warning: '#B7791F',
  warningBg: '#FBF3E2',

  // Lines & skeletons
  border: '#E3E0D8',
  borderStrong: '#D2CEC3',
  skeleton: '#E5E2DA',
  overlay: 'rgba(23, 32, 27, 0.45)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const shadow = {
  card: {
    shadowColor: '#1F2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  drawer: {
    shadowColor: '#1F2A24',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

/** Viewport width at/below which the sidebar collapses. */
export const NARROW_BREAKPOINT = 820;
