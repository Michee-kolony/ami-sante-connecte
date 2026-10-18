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
    },
  },
  plugins: [],
}
