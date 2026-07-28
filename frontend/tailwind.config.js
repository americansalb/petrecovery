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
          bg: '#f6f7f6',        // app background (the page)
          panel: '#f3f4f3',     // right-rail panel
          surface: '#ffffff',   // card
          line: '#e9eae9',      // hairline border / divider
          lineSoft: '#f0f1f0',  // softer inner divider
          ink: '#1b1d1e',       // primary text
          sub: '#6a7075',       // secondary text
          faint: '#a0a5a9',     // labels / tertiary
          teal: '#0f5750',      // primary accent / hero
          tealDark: '#0b3f39',  // gradient end / strong
          tealWash: '#eef3f2',  // tint fill
          tealRing: '#dbe6e3',  // ring on tinted circles
          mint: '#a9ddd2',      // accent on teal ground
          amber: '#a2761c',     // due-soon
          amberWash: '#f8f2e4',
          amberLine: '#ecdcbb',
        },
      },
      /* === Font Family === */
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Paper Passport voices: the diary hand and the rubber stamp
        diary: ['Georgia', '"Times New Roman"', 'serif'],
        stamp: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      /* === Care type scale ===
         The care surfaces had grown 12+ ad-hoc sizes including half-pixel
         values (11.5, 12.5, 13.5, 14.5) with no line-height control, which
         is most of why they read thin and unconsidered. Seven steps, each
         with its own leading and optical tracking. Use these on /pets and
         /care instead of text-[13px]. */
      fontSize: {
        'care-xs':   ['11px', { lineHeight: '15px', letterSpacing: '0.02em' }],
        'care-sm':   ['13px', { lineHeight: '19px' }],
        'care-base': ['15px', { lineHeight: '23px' }],
        'care-lg':   ['17px', { lineHeight: '24px', letterSpacing: '-0.006em' }],
        'care-xl':   ['21px', { lineHeight: '28px', letterSpacing: '-0.014em' }],
        'care-2xl':  ['27px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        'care-3xl':  ['34px', { lineHeight: '38px', letterSpacing: '-0.026em' }],
      },
      /* === Border Radius ===
         care-* is the care product's four-step radius scale, replacing the
         eleven different radii the pet surfaces had accumulated. */
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        'care-sm': '10px',
        'care': '14px',
        'care-lg': '20px',
        'care-xl': '26px',
      },
      /* === Box Shadows === */
      boxShadow: {
        'tile': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.03)',
        'care': '0 1px 2px rgba(20,40,38,.04), 0 6px 20px -12px rgba(20,40,38,.14), inset 0 0 0 1px #f0f1f0',
        'care-hero': '0 18px 40px -18px rgba(11,63,57,.6), 0 2px 6px rgba(11,63,57,.18)',
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
