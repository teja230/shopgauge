import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // Blue
      light: '#60a5fa',
      dark: '#1d4ed8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#16a34a', // Green
      light: '#4ade80',
      dark: '#15803d',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626', // Red
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706', // Amber
      light: '#fbbf24',
      dark: '#b45309',
      contrastText: '#ffffff',
    },
    success: {
      main: '#059669', // Emerald
      light: '#34d399',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0891b2', // Cyan
      light: '#22d3ee',
      dark: '#0e7490',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2937',
      secondary: '#6b7280',
      disabled: '#9ca3af',
    },
    divider: '#e5e7eb',
    action: {
      hover: 'rgba(37, 99, 235, 0.04)',
      selected: 'rgba(37, 99, 235, 0.08)',
      disabled: 'rgba(37, 99, 235, 0.26)',
      disabledBackground: 'rgba(37, 99, 235, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    // Responsive typography with mobile-first approach
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
      '@media (max-width:600px)': {
        fontSize: '2rem',
        lineHeight: 1.3,
      },
      '@media (max-width:475px)': {
        fontSize: '1.75rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
        lineHeight: 1.3,
      },
      '@media (max-width:475px)': {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.3,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
      '@media (max-width:475px)': {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
      '@media (max-width:475px)': {
        fontSize: '1.125rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '1.125rem',
      },
      '@media (max-width:475px)': {
        fontSize: '1rem',
      },
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '0.9375rem',
      },
      '@media (max-width:475px)': {
        fontSize: '0.875rem',
      },
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.9375rem',
      },
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.8125rem',
      },
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      '@media (max-width:600px)': {
        fontSize: '0.9375rem',
        lineHeight: 1.5,
      },
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      '@media (max-width:600px)': {
        fontSize: '0.8125rem',
      },
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
      '@media (max-width:600px)': {
        fontSize: '0.6875rem',
      },
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      lineHeight: 1.4,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.025em',
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  components: {
    // Enhanced Card component
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[2],
          borderRadius: 16,
          border: `1px solid ${theme.palette.divider}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
          [theme.breakpoints.down('sm')]: {
            borderRadius: 12,
          },
        }),
      },
    },
    
    // Enhanced Button component with mobile optimization
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          minHeight: 44,
          padding: theme.spacing(1.5, 3),
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
          },
          // Mobile optimizations
          [theme.breakpoints.down('sm')]: {
            minHeight: 48,
            padding: theme.spacing(2, 3),
            fontSize: '1rem',
            borderRadius: 14,
          },
          // Disable hover transform on touch devices
          '@media (hover: none)': {
            '&:hover': {
              transform: 'none',
            },
          },
        }),
        containedPrimary: ({ theme }) => ({
          boxShadow: theme.shadows[2],
          '&:hover': {
            boxShadow: theme.shadows[4],
          },
        }),
        outlined: ({ theme }) => ({
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        }),
      },
    },
    
    // Enhanced TextField component for mobile
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.3s ease',
            // Prevent iOS zoom on focus
            fontSize: '16px',
            [theme.breakpoints.up('sm')]: {
              fontSize: '14px',
            },
            '&:hover': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.primary.light,
              },
            },
            '&.Mui-focused': {
              '& .MuiOutlinedInput-notchedOutline': {
                borderWidth: '2px',
                borderColor: theme.palette.primary.main,
              },
            },
          },
          '& .MuiFormLabel-root': {
            fontSize: '16px',
            [theme.breakpoints.up('sm')]: {
              fontSize: '14px',
            },
          },
        }),
      },
    },

    // Enhanced IconButton for touch
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minWidth: 44,
          minHeight: 44,
          padding: theme.spacing(1),
          borderRadius: 12,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.05)',
          },
          [theme.breakpoints.down('sm')]: {
            minWidth: 48,
            minHeight: 48,
            padding: theme.spacing(1.25),
          },
          '@media (hover: none)': {
            '&:hover': {
              transform: 'none',
            },
          },
        }),
      },
    },

    // Enhanced Table components for mobile
    MuiTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.down('md')]: {
            display: 'none', // Hide tables on mobile, use cards instead
          },
        }),
      },
    },

    // Enhanced Chip component
    MuiChip: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 20,
          fontWeight: 500,
          height: 32,
          fontSize: '0.8125rem',
          [theme.breakpoints.down('sm')]: {
            height: 36,
            fontSize: '0.875rem',
            minHeight: 36, // Ensure touch target
          },
        }),
      },
    },

    // Enhanced AppBar for mobile
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[2],
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },

    // Enhanced Drawer for mobile
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: '16px 0 0 16px',
          [theme.breakpoints.down('sm')]: {
            borderRadius: '12px 0 0 12px',
          },
        }),
      },
    },

    // Enhanced Dialog for mobile
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 16,
          margin: theme.spacing(2),
          [theme.breakpoints.down('sm')]: {
            borderRadius: 12,
            margin: theme.spacing(1),
            width: `calc(100% - ${theme.spacing(2)})`,
            maxWidth: 'none',
          },
        }),
      },
    },

    // Enhanced Tooltip for mobile
    MuiTooltip: {
      styleOverrides: {
        tooltip: ({ theme }) => ({
          fontSize: '0.875rem',
          borderRadius: 8,
          padding: theme.spacing(1, 1.5),
          [theme.breakpoints.down('sm')]: {
            fontSize: '0.9375rem',
            padding: theme.spacing(1.25, 2),
          },
        }),
      },
    },

    // Enhanced Fab for mobile
    MuiFab: {
      styleOverrides: {
        root: ({ theme }) => ({
          boxShadow: theme.shadows[4],
          '&:hover': {
            boxShadow: theme.shadows[8],
          },
          [theme.breakpoints.down('sm')]: {
            width: 64,
            height: 64,
          },
        }),
      },
    },

    // Enhanced Accordion for mobile
    MuiAccordion: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          boxShadow: theme.shadows[1],
          border: `1px solid ${theme.palette.divider}`,
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: 0,
            '&:first-of-type': {
              marginTop: 0,
            },
            '&:last-of-type': {
              marginBottom: 0,
            },
          },
        }),
      },
    },

    // Enhanced Tabs for mobile
    MuiTabs: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
            minHeight: 48,
            minWidth: 'auto',
            padding: theme.spacing(1.5, 3),
            [theme.breakpoints.down('sm')]: {
              minHeight: 52,
              padding: theme.spacing(2, 2.5),
              fontSize: '1rem',
            },
          },
        }),
      },
    },

    // Enhanced Snackbar for mobile
    MuiSnackbar: {
      styleOverrides: {
        root: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: {
            left: theme.spacing(1),
            right: theme.spacing(1),
            bottom: theme.spacing(1),
            '& .MuiSnackbarContent-root': {
              borderRadius: 12,
              fontSize: '0.9375rem',
            },
          },
        }),
      },
    },
  },
});

export default theme; 