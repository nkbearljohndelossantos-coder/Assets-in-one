/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4f8',
          100: '#dbeafe',
          200: '#bfdbfe',
          800: '#1e3a8a', // Navy blue light
          900: '#0f172a', // Navy blue dark (main slate-900)
          DEFAULT: '#0f172a',
        },
        gold: {
          50: '#fefbeb',
          100: '#fef3c7',
          500: '#f59e0b', // Gold standard
          600: '#d97706', // Gold dark
          700: '#b45309', // Gold accent deep
        }
      },
    },
  },
  plugins: [],
}
