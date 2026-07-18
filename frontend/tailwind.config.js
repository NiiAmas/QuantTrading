/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0B0C10',
        molten: '#D4AF37',
        success: '#10B981',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
}
