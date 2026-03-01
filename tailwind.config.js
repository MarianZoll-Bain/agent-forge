/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 25px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)',
        elevated: '0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)',
        glow: '0 0 20px rgba(99,102,241,0.15)',
        'glow-lg': '0 0 40px rgba(99,102,241,0.2)',
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-up': 'slide-in-up 0.25s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
}
