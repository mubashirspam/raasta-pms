import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Warm gold stays the brand accent, darkened so it passes contrast
        // on white — the old #D4AF37 was unreadable as text on a light ground.
        gold: {
          50: '#FDF9EC',
          100: '#F9EFCC',
          200: '#F1DE9B',
          300: '#E4C862',
          400: '#D4AF37',
          500: '#B8942A',
          600: '#96771F',
          700: '#735B18',
        },
        raasta: {
          bg: '#F7F7F5',      // page ground
          surface: '#FFFFFF', // cards
          subtle: '#F1F1EE',  // inset panels, hover
          border: '#E3E3DE',
          line: '#EFEFEB',    // lighter divider
          ink: '#17171A',     // primary text
          muted: '#6B6B72',   // secondary text
          faint: '#9A9AA1',   // tertiary text
        },
        ok: { 50: '#ECFDF3', 500: '#12894C', 600: '#0F7340' },
        warn: { 50: '#FFF8EB', 500: '#B7791F' },
        bad: { 50: '#FEF2F2', 500: '#C4372F', 600: '#A62E27' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23,23,26,0.04), 0 1px 3px rgba(23,23,26,0.06)',
        lift: '0 4px 12px rgba(23,23,26,0.08), 0 2px 4px rgba(23,23,26,0.04)',
        pop: '0 8px 28px rgba(23,23,26,0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
    },
  },
  plugins: [],
};

export default config;
