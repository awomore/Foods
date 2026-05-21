import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        spice:  '#C84B31',
        ember:  '#A83A22',
        parchment: '#FAF6F1',
        warm:   '#F0E8DC',
        ink:    '#1A1208',
        stone:  '#6B5B4E',
        muted:  '#9C8D80',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
