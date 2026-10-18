/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    // « container » façon Bootstrap : centré, marges intérieures, largeurs max par palier
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        sm: '540px',
        md: '720px',
        lg: '960px',
        xl: '1140px',
        '2xl': '1320px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Bleu du logo : #0055A5 (cœur) et #13295F (texte « AMI Santé »)
        brand: {
          50: '#eef5fd',
          100: '#d8e8f9',
          200: '#b4d2f2',
          300: '#80b3e7',
          400: '#4a8fd8',
          500: '#1f6fc4',
          600: '#0a5fb5',
          700: '#0055a5',
          800: '#0b4385',
          900: '#13295f',
          950: '#0c1a3f',
        },
        // Vert du logo : #24894A (« Connect », feuille)
        accent: {
          50: '#ecf8f0',
          100: '#d1eedb',
          200: '#a5dcb9',
          300: '#6fc391',
          400: '#43a76b',
          500: '#2b9655',
          600: '#24894a',
          700: '#1e6f3d',
          800: '#1b5833',
          900: '#17482b',
          950: '#0a2817',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        // Chatbot : ouverture de la fenêtre, bulles, bouton et points de saisie
        'chat-in': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.92)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'bulle-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.3) rotate(-20deg)' },
          '60%': { opacity: '1', transform: 'scale(1.12) rotate(4deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        point: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        // Hero : tracé de l'électrocardiogramme et formes flottantes
        trace: {
          '0%': { strokeDashoffset: '1' },
          '100%': { strokeDashoffset: '0' },
        },
        flotte: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(4deg)' },
        },
        // Pied de page : vagues qui ondulent
        vague: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'chat-in': 'chat-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'bulle-in': 'bulle-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        point: 'point 1.1s ease-in-out infinite',
        trace: 'trace 2.8s cubic-bezier(0.65, 0, 0.35, 1) 0.4s both',
        flotte: 'flotte 7s ease-in-out infinite',
        'vague-lente': 'vague 22s linear infinite',
        'vague-rapide': 'vague 14s linear infinite',
      },
    },
  },
  plugins: [],
}
