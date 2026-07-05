/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* === Custom Colors: Midnight Blue + Flashlight Yellow === */
      colors: {
        midnight: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        flash: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        /* === The Paper Passport: the care product's world ===
           The Health Book IS a book: cream paper, navy ink, rubber
           stamps, a highlighter. Rescue surfaces stay midnight/flash;
           these tokens belong to /pets and /care only. */
        paper: {
          50: '#fbf7ee',   // sheet
          100: '#f6efe3',  // ground
          200: '#efe5d2',
          300: '#e7dcc6',  // edges, dividers
          400: '#d9cdb2',  // borders
        },
        pen: {
          900: '#232a3d',  // ink
          600: '#5d5442',  // soft ink
          400: '#8a7f68',  // faded ink (captions)
          300: '#b3a88e',  // ghost ink
        },
        stampred: {
          DEFAULT: '#b3392e',
          dark: '#9c3227',
          wash: '#f6e3e0',
        },
        stampgreen: {
          DEFAULT: '#3e6b4f',
          wash: '#e4ecdf',
        },
        marker: {
          DEFAULT: '#e0a92c',
          wash: '#f8ecd0',
        },
        /* === Care product: the Apple Health register ===
           A warm grouped background behind white rounded tiles, so tiles
           read as tiles from contrast, not heavy borders. Rescue surfaces
           stay midnight/flash; these belong to /pets and /care only. */
        care: {
          bg: '#f4f3f1',       // warm grouped background (the page)
          surface: '#ffffff',  // tile
          line: '#e7e5e1',     // hairline border / divider
          ink: '#1c1c1e',      // primary text
          sub: '#8a8a8e',      // secondary text / labels
        },
      },
      /* === Font Family === */
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Paper Passport voices: the diary hand and the rubber stamp
        diary: ['Georgia', '"Times New Roman"', 'serif'],
        stamp: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      /* === Border Radius === */
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      /* === Box Shadows === */
      boxShadow: {
        'tile': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03)',
        'soft': '0 2px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'glow-flash': '0 0 20px rgba(250, 204, 21, 0.3)',
        'glow-danger': '0 0 20px rgba(220, 38, 38, 0.3)',
      },
      /* === Animations === */
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
