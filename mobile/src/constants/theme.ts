export const Colors = {
  // Core palette — from prototype CSS vars
  ink: '#1A1208',           // var(--ink) — dark warm brown
  canvas: '#FAF6F0',        // var(--canvas) — cream off-white
  ember: '#E8924A',         // var(--ember) — warm orange accent
  spice: '#B36A2E',         // var(--spice) — primary brand color

  // Backgrounds
  bg: '#FAF6F0',            // var(--bg)
  bgCook: '#F5F0E8',        // var(--bg-cook) — slightly warmer
  bgCard: '#FFFFFF',        // var(--bg-card)

  // Text
  textInk: '#1A1208',       // var(--text-ink)
  body: '#4A3F30',          // var(--body)
  bodySoft: '#8A7A68',      // var(--body-soft)
  caps: '#A89880',          // var(--caps)

  // Borders
  borderWarm: '#E8DDD0',    // var(--border-warm)

  // Status
  leaf: '#2E8B3F',          // cooking-now green
  stone: '#D4C8B8',         // done/inactive

  // Semantic
  successBg: '#EBF5EE',
  successFg: '#2E8B3F',
  errorBg: '#FAECE7',
  errorFg: '#C0392B',
  warnBg: '#FEF3E2',
  warnFg: '#B36A2E',
  infoBg: '#EBF0FA',
  infoFg: '#2A5FBF',
  healthBg: '#EDF4EE',
  healthFg: '#2A6640',
  honey: '#FFF0C2',
  cream: '#F5F0E8',

  // Aliases for compatibility
  primary: '#B36A2E',
  white: '#FFFFFF',
  black: '#1A1208',
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
    shadowColor: '#1A1208',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lift: {
    shadowColor: '#1A1208',
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
