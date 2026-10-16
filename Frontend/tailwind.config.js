/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['15px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '44px' }],
      '5xl': ['48px', { lineHeight: '1.15' }],
      '6xl': ['60px', { lineHeight: '1.1' }],
      '7xl': ['72px', { lineHeight: '1.05' }],
    },
    extend: {
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        indigo: {
          brand: '#2E3192',
          DEFAULT: '#2E3192',
        },
        cyan: {
          brand: '#1CB5D6',
          DEFAULT: '#1CB5D6',
        },
        navy: {
          dark: '#0E1230',
          DEFAULT: '#0E1230',
        },
        'soft-surface': '#F4F7FC',
        heading: '#141833',
        body: '#5A6180',
        success: {
          green: '#1FA971',
          DEFAULT: '#1FA971',
        },
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
          500: '#2E3192',
          600: '#2E3192',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#0E1230',
          950: '#0E1230',
          accent: '#1CB5D6',
          blue: '#2E3192',
          purple: '#2E3192',
        }
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        bento: '0 1px 2px rgba(14, 18, 48, 0.04), 0 12px 32px rgba(46, 49, 146, 0.08)',
        'bento-hover': '0 4px 8px rgba(14, 18, 48, 0.06), 0 16px 40px rgba(28, 181, 214, 0.14)',
        card: '0 1px 2px 0 rgba(79, 70, 229, 0.04)',
        elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '8px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      }
    },
  },
  plugins: [],
}
