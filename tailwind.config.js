/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./dashboard/**/*.{html,js}",
    "./src/**/*.{html,js}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0b0b0d',
          card: '#121214',
          border: '#27272a'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          '"SF Mono"',
          '"Cascadia Code"',
          '"Segoe UI Mono"',
          '"Roboto Mono"',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
