import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        spice:     '#C84B31',
        ember:     '#A83A22',
        parchment: '#FAF6F1',
        cream:     '#FFFDF9',
        warm:      '#F0E8DC',
        border:    '#E4D9CE',
        ink:       '#1A1208',
        charcoal:  '#2D2416',
        stone:     '#6B5B4E',
        muted:     '#9C8D80',
        gold:      '#C49A3C',
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
        'warm-sm': '0 1px 4px 0 rgba(26,18,8,0.06)',
        'warm':    '0 4px 20px 0 rgba(26,18,8,0.08)',
        'warm-lg': '0 12px 48px 0 rgba(26,18,8,0.12)',
        'warm-xl': '0 24px 80px 0 rgba(26,18,8,0.16)',
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
