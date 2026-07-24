/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Claude.ai default theme palette. Overriding Tailwind's built-in
        // `emerald` (accent) and `slate` (neutrals) scales means every
        // existing `bg-emerald-500`, `text-slate-100`, etc. class across the
        // whole app repaints as the Claude look with zero per-component
        // changes — one source of truth for the theme.
        emerald: {
          // -> Claude's signature terracotta/clay accent (~#D97757)
          50: '#FAF3EE', 100: '#F3E1D6', 200: '#E8C4AE', 300: '#DBA482',
          400: '#E08A62', 500: '#D97757', 600: '#C15F3C', 700: '#A14A2C',
          800: '#7D3A23', 900: '#5C2B1A', 950: '#3A1B10',
        },
        slate: {
          // -> Claude's warm neutral (clay/stone) dark-mode scale instead of
          // Tailwind's cool blue-gray.
          50: '#FAF9F7', 100: '#F0EEE9', 200: '#E5E2DA', 300: '#CAC5B9',
          400: '#A39C8E', 500: '#7C7565', 600: '#5C564A', 700: '#454039',
          800: '#33302B', 900: '#262421', 950: '#191714',
        },
        primary: {
          50: '#FAF3EE', 100: '#F3E1D6', 200: '#E8C4AE', 300: '#DBA482',
          400: '#E08A62', 500: '#D97757', 600: '#C15F3C', 700: '#A14A2C',
          800: '#7D3A23', 900: '#5C2B1A', 950: '#3A1B10',
        },
        accent: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out both',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scaleIn 0.2s ease-out both',
        'pop': 'pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
