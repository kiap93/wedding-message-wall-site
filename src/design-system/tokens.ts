// EventFrame.io Design Tokens
// Modern Editorial SaaS Palette and Geometry

export const tokens = {
  colors: {
    bg: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#FAF9F7',
    primary: '#252525',
    secondary: '#777777',
    tertiary: '#999999',
    muted: '#B0ADA8',
    border: '#E8E8E5',
    borderSubtle: '#EFEFEA',
    borderStrong: '#D4D4CE',
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
    semantic: {
      success: '#16A34A',
      successBg: '#F0FDF4',
      successBorder: '#BBF7D0',
      warning: '#D97706',
      warningBg: '#FFFBEB',
      warningBorder: '#FDE68A',
      error: '#DC2626',
      errorBg: '#FEF2F2',
      errorBorder: '#FECACA',
    }
  },
  fonts: {
    ui: 'Inter, system-ui, -apple-system, sans-serif',
    editorial: 'Cormorant Garamond, Georgia, serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
  },
  radii: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  }
} as const;
