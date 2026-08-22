import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F19',
        'bg-elevated': '#101526',
        sapphire: '#2563EB',
        'sapphire-soft': 'rgba(37, 99, 235, 0.16)',
        ivory: '#F8FAFC',
        muted: '#8891A7',
        line: 'rgba(148, 163, 184, 0.12)',
        emerald: '#10B981',
        amber: '#F59E0B',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
