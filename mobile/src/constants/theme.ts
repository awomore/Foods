export const Colors = {
  // Core palette — pure-white design system
  ink: '#111827',           // secondary accent / dark surfaces — near-black, neutral
  canvas: '#FFFFFF',        // light text/elements on dark surfaces
  ember: '#FF8A5C',         // lighter orange highlight (sparingly)
  spice: '#FF6B35',         // primary accent

  // Backgrounds — elevation via surface, not warmth
  bg: '#FFFFFF',            // primary background
  bgCook: '#F5F5F5',        // tertiary surface
  bgCard: '#FFFFFF',        // card background

  // Text
  textInk: '#111827',       // primary text
  body: '#4B5563',          // secondary text
  bodySoft: '#6B7280',      // muted text
  caps: '#9CA3AF',          // disabled / caps labels

  // Borders
  borderWarm: '#E5E7EB',    // neutral hairline border

  // Status
  leaf: '#16A34A',          // success green
  stone: '#9CA3AF',         // placeholder / inactive

  // Semantic
  successBg: '#F0FDF4',
  successFg: '#16A34A',
  errorBg: '#FEF2F2',
  errorFg: '#DC2626',
  warnBg: '#FFFBEB',
  warnFg: '#B45309',
  infoBg: '#EFF6FF',
  infoFg: '#2563EB',
  healthBg: '#F0FDF4',
  healthFg: '#15803D',
  honey: '#FFF1EB',         // subtle orange tint for accent icon backdrops
  cream: '#FAFAFA',         // secondary surface

  // Aliases for compatibility
  primary: '#FF6B35',
  white: '#FFFFFF',
  black: '#111827',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  body: 15,
  lg: 16,
  xl: 20,
  xxl: 28,
  display: 34,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

export const Shadow = {
  card: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lift: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
};

// Typography helpers — apply fontFamily per text type
export const Fonts = {
  serif: 'DMSerifDisplay_400Regular',
  serifItalic: 'DMSerifDisplay_400Regular_Italic',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansLight: 'DMSans_300Light',
};
