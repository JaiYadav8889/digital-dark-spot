/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep midnight navy foundation
        ink: {
          950: '#070A14',
          900: '#0A0E1A',
          850: '#0D1220',
          800: '#111827',
          700: '#1A2234',
          600: '#232C42',
          500: '#2E3850',
        },
        slatey: {
          400: '#8791A8',
          300: '#A7B0C4',
          200: '#C8CEDC',
        },
        violet: {
          brand: '#7C5CFF',
          soft: '#9B85FF',
          deep: '#5B3FE0',
        },
        ice: {
          DEFAULT: '#4FD1E5',
          soft: '#8BE4F2',
        },
        emerald: {
          muted: '#3FB98A',
        },
        amber: {
          warm: '#E8A33D',
        },
        coral: {
          soft: '#F4746A',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 30px -18px rgba(0,0,0,0.9)',
        lift: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -28px rgba(0,0,0,0.95)',
        glow: '0 0 0 1px rgba(124,92,255,0.35), 0 18px 50px -24px rgba(124,92,255,0.55)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(circle at 50% 0%, rgba(124,92,255,0.16), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
