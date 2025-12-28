/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        // Cian Médico - Primary color for buttons, navbar, loading indicators, selection borders
        primary: {
          50: '#e6f7f7',
          100: '#b3e8e6',
          200: '#80d9d5',
          300: '#4dcac4',
          400: '#20b5ae',
          500: '#20b5ae', // Main
          600: '#1a9a94',
          700: '#147e79',
          800: '#0e635f',
          900: '#084744',
        },
        // Naranja Iris - Retina lesion markers, critical alerts, chart accents
        accent: {
          50: '#fef2e6',
          100: '#fcdcb8',
          200: '#fac68a',
          300: '#f8b05c',
          400: '#d87a1a',
          500: '#b34b00', // Main
          600: '#9a4100',
          700: '#813700',
          800: '#682d00',
          900: '#4f2300',
        },
        // Gris Antracita - Main titles, primary text, navigation icons
        coal: {
          50: '#f5f5f5',
          100: '#e0e0e0',
          200: '#c2c2c2',
          300: '#a3a3a3',
          400: '#858585',
          500: '#575756', // Main
          600: '#4a4a49',
          700: '#3d3d3c',
          800: '#30302f',
          900: '#232322',
        },
        // Gris Humo - Secondary text, footers, data labels
        smoke: {
          50: '#fafafa',
          100: '#f0f0f0',
          200: '#e3e3e3',
          300: '#d1d1d1',
          400: '#afafaf',
          500: '#878787', // Main
          600: '#6f6f6f',
          700: '#575757',
          800: '#3f3f3f',
          900: '#272727',
        },
        // Blanco Nieve - Card backgrounds, AI visualizer containers
        snow: '#FFFFFF',
        // Gris Hielo - App general background
        ice: '#F8FAFC',
        // Colores para tema oscuro
        dark: {
          background: '#121212',
          surface: '#1e1e1e',
          text: '#e0e0e0',
          textSecondary: '#a0a0a0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'strong': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.12)',
        'light': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'contribute-pulse': {
          '0%, 100%': {
            color: '#878787', // smoke-500 (gris)
            transform: 'scale(1)',
          },
          '33%': {
            color: '#a855f7', // violeta/púrpura brillante
            transform: 'scale(1.1)',
          },
          '66%': {
            color: '#f59e0b', // dorado/ámbar brillante
            transform: 'scale(1.1)',
          },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'contribute-pulse': 'contribute-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
