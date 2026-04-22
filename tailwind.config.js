/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      minWidth: {
        '20': '80px',
      },
      gap: {
        '1.5': '6px',
      },
      colors: {
        background: '#190408',
        filler: {
          light: '#3f3f46', // zinc-700
          dark:  '#27272a', // zinc-800
        },
        primary: {
          DEFAULT: '#db2777', // pink-600
          light:   '#ec4899', // pink-500
          dark:    '#be185d', // pink-700
        },
        success: {
          DEFAULT: '#059669', // emerald-600
          light:   '#047857', // emerald-700
          dark:    '#064e3b', // emerald-900
        },
        danger: {
          DEFAULT: '#dc2626', // red-600
        },
        warn: {
          DEFAULT: '#f59e0b', // amber-400
          text:    '#fcd34d', // amber-200
          bg:      '#451a03', // amber-950
        },
        alert: {
          DEFAULT: '#dc2626', // red-600
          text:    '#fca5a5', // red-300
          bg:      '#450a0a', // red-950
        },
        hrv:   '#34d399',     // emerald-400
        trace: '#ec4899',     // pink-400
        muted: '#52525b',     // zinc-600
        card:  '#27272a',     // zinc-800
        blue: {
          reading: '#60a5fa', // blue-400
        },
      }
    },
  },
  plugins: [],
}
