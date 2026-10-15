/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontSize: {
      xs: ['11px', { lineHeight: '15px' }],
      sm: ['12.5px', { lineHeight: '17px' }],
      base: ['13px', { lineHeight: '18px' }],
      lg: ['15px', { lineHeight: '21px' }],
      xl: ['17px', { lineHeight: '23px' }],
      '2xl': ['20px', { lineHeight: '26px' }],
      '3xl': ['24px', { lineHeight: '30px' }],
      '4xl': ['30px', { lineHeight: '36px' }],
    },
    extend: {
      colors: {
        surface: 'var(--surface, #FFFFFF)',
        'surface-subtle': 'var(--surface-subtle, #F8FAFC)',
        'border-color': 'var(--border-color, #E5E7EB)',
        'text-primary': 'var(--text-primary, #1F2937)',
        'text-secondary': 'var(--text-secondary, #4B5563)',
        brand: {
          50: 'var(--brand-50, #eff6ff)',
          100: 'var(--brand-100, #dbeafe)',
          200: 'var(--brand-200, #bfdbfe)',
          300: 'var(--brand-300, #93c5fd)',
          400: 'var(--brand-400, #60a5fa)',
          500: 'var(--brand-500, #623CD0)',
          600: 'var(--brand-600, #006EEE)',
          700: 'var(--brand-700, #1d4ed8)',
          800: 'var(--brand-800, #1e40af)',
          900: 'var(--brand-900, #1e3a8a)',
          950: 'var(--brand-950, #172554)',
          accent: 'var(--brand-accent, #006EEE)',
          blue: 'var(--brand-blue, #006EEE)',
          purple: 'var(--brand-purple, #623CD0)',
        }
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        card: '0 1px 2px 0 rgba(79, 70, 229, 0.04)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '8px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '16px',
      }
    },
  },
  plugins: [],
}
