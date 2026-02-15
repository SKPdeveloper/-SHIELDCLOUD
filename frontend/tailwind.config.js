/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Основна палітра ShieldCloud
        shield: {
          // Світлі тони (для тексту на темному фоні)
          light: '#F3F4F5',
          mist: '#D0E0E1',
          // Акцентні помаранчеві
          orange: '#FF9400',
          gold: '#FCA316',
          // Темні тони
          crimson: '#95122C',
          dark: '#100C00',
          // Проміжні
          ember: '#C75A10',
          blood: '#7A0F24',
        },
        // Функціональні кольори
        primary: {
          50: '#FFF5E6',
          100: '#FFE4BF',
          200: '#FFD399',
          300: '#FFC166',
          400: '#FFB033',
          500: '#FF9400',
          600: '#E68500',
          700: '#CC7600',
          800: '#B36700',
          900: '#995800',
        },
        danger: {
          50: '#FCE8EB',
          100: '#F5C4CB',
          200: '#EE9FAB',
          300: '#D85A6A',
          400: '#C2354A',
          500: '#95122C',
          600: '#850F27',
          700: '#750D22',
          800: '#650B1D',
          900: '#550918',
        },
        success: {
          50: '#E6F9E6',
          100: '#C2F0C2',
          500: '#2ECC71',
          600: '#27AE60',
        },
        warning: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          500: '#FCA316',
          600: '#E69414',
        },
        // Базові кольори для UI
        bg: {
          primary: '#100C00',
          secondary: '#1A1510',
          tertiary: '#2A2015',
          card: '#201810',
        },
        border: {
          DEFAULT: '#FF9400',
          muted: '#95122C',
          light: '#FCA316',
        },
        text: {
          primary: '#F3F4F5',
          secondary: '#D0E0E1',
          muted: '#A09080',
          accent: '#FF9400',
        }
      },
      // Зрізані кути
      clipPath: {
        'cut-corner': 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)',
        'cut-corner-sm': 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        'cut-corner-lg': 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
      },
      backgroundImage: {
        'gradient-shield': 'linear-gradient(135deg, #FF9400 0%, #95122C 100%)',
        'gradient-dark': 'linear-gradient(180deg, #1A1510 0%, #100C00 100%)',
        'gradient-card': 'linear-gradient(135deg, #201810 0%, #100C00 100%)',
        'gradient-accent': 'linear-gradient(90deg, #FF9400 0%, #FCA316 100%)',
        'gradient-danger': 'linear-gradient(90deg, #95122C 0%, #C75A10 100%)',
      },
      boxShadow: {
        'shield': '0 0 20px rgba(255, 148, 0, 0.3)',
        'shield-lg': '0 0 40px rgba(255, 148, 0, 0.4)',
        'crimson': '0 0 20px rgba(149, 18, 44, 0.5)',
      },
      animation: {
        'pulse-shield': 'pulse-shield 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-shield': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 148, 0, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 148, 0, 0.6)' },
        },
        'glow': {
          '0%': { textShadow: '0 0 10px rgba(255, 148, 0, 0.5)' },
          '100%': { textShadow: '0 0 20px rgba(255, 148, 0, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
