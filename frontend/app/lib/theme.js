// Beautiful, warm, hopeful color palette for pet recovery
export const theme = {
  // Gradients - warm and inviting
  gradients: {
    sunrise: 'linear-gradient(135deg, #ff6b9d 0%, #ffa06b 50%, #ffd93d 100%)',
    sunset: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    ocean: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    forest: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    hope: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    warmth: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    sky: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    reunion: 'linear-gradient(135deg, #ffdde1 0%, #ee9ca7 100%)',
  },

  // Primary colors - warm and emotional
  colors: {
    // Pet Owner mode - warm oranges and pinks (caring, nurturing)
    petOwner: {
      primary: '#ff6b6b',      // Warm coral red
      secondary: '#ffa06b',    // Warm orange
      accent: '#ff8fab',       // Soft pink
      background: '#fff5f5',   // Very light warm
      card: '#ffffff',
    },

    // Patrol mode - blues and purples (heroic, supportive)
    patrol: {
      primary: '#667eea',      // Vibrant purple-blue
      secondary: '#764ba2',    // Deep purple
      accent: '#4facfe',       // Bright blue
      background: '#f0f4ff',   // Very light blue
      card: '#ffffff',
    },

    // Status colors
    status: {
      active: '#ff6b6b',       // Urgent red
      found: '#38ef7d',        // Happy green
      sighting: '#ffa06b',     // Alert orange
      waiting: '#a8a8a8',      // Neutral gray
    },

    // Semantic colors
    success: '#38ef7d',
    warning: '#ffa06b',
    error: '#ff6b6b',
    info: '#4facfe',

    // Neutrals with warmth
    gray: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },

  // Modern shadows
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
    md: '0 4px 16px rgba(0, 0, 0, 0.12)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.16)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.20)',
    colored: {
      petOwner: '0 8px 32px rgba(255, 107, 107, 0.25)',
      patrol: '0 8px 32px rgba(102, 126, 234, 0.25)',
    },
  },

  // Border radius - modern and soft
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },

  // Spacing scale
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // Typography - modern and friendly
  fonts: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: '"SF Pro Display", system-ui, -apple-system, sans-serif',
  },
};

// Helper function for glassmorphism effect
export const glass = (opacity = 0.8) => ({
  background: `rgba(255, 255, 255, ${opacity})`,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
});

// Helper for card styles
export const card = (mode = 'neutral') => ({
  backgroundColor: 'white',
  borderRadius: theme.radius.lg,
  boxShadow: mode === 'pet-owner' ? theme.shadows.colored.petOwner :
             mode === 'patrol' ? theme.shadows.colored.patrol :
             theme.shadows.md,
  padding: theme.spacing.lg,
});
