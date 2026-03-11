import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'color-w': '#f9f6ee',
        'color-u': '#c1d7e9',
        'color-b': '#c2bfba',
        'color-r': '#f4a27a',
        'color-g': '#9fd198',
        'color-m': '#f5e17a',
        'color-c': '#d0d0d0',
        'color-l': '#d3b48c',
      },
      zIndex: {
        'sticky': '20',
        'dropdown': '50',
        'preview': '90',
        'modal': '100',
        'skip': '200',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
