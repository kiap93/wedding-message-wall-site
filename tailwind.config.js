/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#FAF9F7',
          ground: '#F7F7F5',
          elevated: '#FFFFFF',
        },
        content: {
          primary: '#252525',
          secondary: '#777777',
          tertiary: '#999999',
          muted: '#B0ADA8',
        },
        border: {
          DEFAULT: '#E8E8E5',
          subtle: '#EFEFEA',
          strong: '#D4D4CE',
        },
        taupe: {
          50: '#F7F5F2',
          100: '#EFECE6',
          200: '#DED9CE',
          300: '#C5BDAC',
          400: '#A49A86',
          DEFAULT: '#8B806F',
          600: '#736959',
          700: '#5A5245',
          800: '#423B32',
          900: '#2A251F',
        },
        // Backwards compatibility for existing wedding custom themes:
        wedding: {
          ivory: '#F7F7F5',
          gold: '#8B806F',
          luxury: '#252525',
          pink: {
            light: '#F8F6F4',
            soft: '#E8DED8',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        dropdown: '0 4px 12px 0 rgba(0, 0, 0, 0.06), 0 1px 3px 0 rgba(0, 0, 0, 0.04)',
        modal: '0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
