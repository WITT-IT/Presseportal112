import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        nav: '901px',
      },
      colors: {
        paper: '#F5F6F5',
        panel: '#ECEDEB',
        ink: {
          DEFAULT: '#14161A',
          2: '#585D64',
          3: '#93969B',
        },
        line: {
          DEFAULT: '#E1E3E1',
          strong: '#CACDCA',
        },
        signal: {
          DEFAULT: '#C81E2C',
          deep: '#8E1420',
        },
        gewerk: {
          feuerwehr: '#C31F2B',
          drk: '#B87A0A',
          polizei: '#245C9C',
          thw: '#1D7A4C',
        },
      },
      fontFamily: {
        display: ['var(--font-barlow)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
