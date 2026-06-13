import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        spice:     '#FF6B35',   // primary accent
        ember:     '#E85A2A',   // primary accent — hover/darker
        parchment: '#FFFFFF',   // primary background
        cream:     '#FAFAFA',   // secondary surface / light-on-dark text
        warm:      '#F5F5F5',   // tertiary surface
        border:    '#E5E7EB',   // neutral border
        ink:       '#111827',   // primary text / secondary accent
        charcoal:  '#1F2937',   // dark hover
        stone:     '#4B5563',   // secondary text
        muted:     '#6B7280',   // muted text
        gold:      '#FF8A5C',   // secondary orange highlight
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
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
