/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/visualizer/index.html',
    './src/visualizer/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        space: {
          950: '#080b11',
          900: '#0f1420',
          850: '#131b2e',
          800: '#161e31',
          700: '#1e293b',
        },
        solar: {
          daylight: '#fbbf24',
          apparent: '#f59e0b',
          geometric: '#94a3b8',
        },
        twilight: {
          civil: '#6366f1',
          nautical: '#3b82f6',
          astronomical: '#1e3a8a',
          night: '#0a0d18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
