export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#ff4d00',
        secondary: '#ffcc00',
        success: '#22c55e',
        danger: '#ef4444',
        edit: '#3b82f6',
        info: '#3b82f6',
        warning: '#facc15',
        special: '#a855f7',
        text: '#e0e0e0',
        'text-muted': '#e2e4e7',
        'bg-dark-primary': '#1a1a1a',
        'bg-dark-secondary': '#0a0a0f',
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
