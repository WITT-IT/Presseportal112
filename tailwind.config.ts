import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        nav: '901px',
      },
      colors: {
        // Warmes Off-White statt kaltes Grau -- der Grundton der ganzen
        // Seite. #F5F6F5 (alt) war neutral-kalt, #F7F6F2 hat einen Hauch
        // Warme drin, wirkt einladender statt nach Amtsformular.
        paper: '#F7F6F2',
        panel: '#EFEDE6',
        ink: {
          DEFAULT: '#101114',
          2: '#585A5F',
          3: '#8A8C93',
        },
        line: {
          DEFAULT: '#EAE8E2',
          strong: '#D8D5CC',
        },
        signal: {
          DEFAULT: '#F0503F',
          deep: '#C13725',
        },
        gewerk: {
          feuerwehr: '#C31F2B',
          drk: '#B87A0A',
          polizei: '#245C9C',
          thw: '#1D7A4C',
        },
        void: {
          DEFAULT: '#08090B',
          2: '#101215',
          3: '#1A1D21',
          line: '#2A2D31',
        },
        amber: {
          DEFAULT: '#E8A93D',
          bright: '#FFC968',
        },
      },
      borderRadius: {
        // Großzügigere Standardrundung -- 6-8px wirkt kantig-technisch,
        // 12-16px ist der Radius, den aktuelle Produkte durchgehend fahren.
        DEFAULT: '10px',
        lg: '14px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        // Weiche, mehrschichtige Schatten statt harter 1px-Ränder --
        // Karten heben sich jetzt durch echte Tiefe ab, nicht durch Linien.
        card: '0 1px 2px rgba(16,17,20,0.04), 0 6px 16px rgba(16,17,20,0.05)',
        'card-hover': '0 2px 4px rgba(16,17,20,0.06), 0 12px 28px rgba(16,17,20,0.09)',
        raised: '0 1px 2px rgba(16,17,20,0.04), 0 8px 20px rgba(16,17,20,0.06)',
        popover: '0 8px 24px rgba(16,17,20,0.12), 0 2px 6px rgba(16,17,20,0.08)',
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
