/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#190408',
        filler: {
          light: '#3f3f46', // zinc-700
          dark: '#27272a',   // zinc-800
        },
        primary: {
          DEFAULT: '#db2777', // pink-600
          light: '#ec4899',   // pink-500
          dark: '#be185d'     // pink-700
        },
        success: {
          DEFAULT: '#059669', // emerald-600
          light: '#047857',   // emerald-500
          dark: '#064e3b'     // emerald-700
        },
        danger: {
          DEFAULT: '#dc2626' // red-600
        }
      }
    },
  },
  plugins: [],
}

