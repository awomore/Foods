import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        spice:     '#FF6B35',   // brand accent
        ember:     '#E85A2A',   // accent hover
        parchment: '#FFFFFF',   // primary background
        cream:     '#FAFAFA',   // secondary surface / light-on-dark text
        warm:      '#F4F4F4',   // tertiary surface (neutral, despite the name)
        border:    '#E6E6E6',   // neutral border
        ink:       '#000000',   // text and dark surfaces: pure black
        charcoal:  '#141414',   // dark hover / second dark surface
        stone:     '#3F3F3F',   // secondary text
        muted:     '#6B6B6B',   // muted text
        gold:      '#FF8A5C',   // secondary orange highlight
      },
      fontFamily: {
        // --font-script is set per language in the root layout (Noto JP, Arabic, Thai…).
        serif: ['"Bricolage Grotesque"', 'Geist', 'var(--font-script)', 'system-ui', 'sans-serif'],
        sans:  ['Geist', 'var(--font-script)', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono:  ['"Geist Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        'display-sm': ['clamp(2.5rem, 5vw, 3.5rem)', { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display':    ['clamp(3rem, 6vw, 5rem)',   { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(3.5rem, 8vw, 7rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
        '38': '9.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        // Soft neutral elevation — depth without warmth
        'warm-sm': '0 1px 3px 0 rgba(17,24,39,0.05)',
        'warm':    '0 4px 16px 0 rgba(17,24,39,0.06)',
        'warm-lg': '0 12px 40px 0 rgba(17,24,39,0.08)',
        'warm-xl': '0 24px 70px 0 rgba(17,24,39,0.10)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-smooth': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(32px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
