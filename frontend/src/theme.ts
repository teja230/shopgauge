import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2f5bea',
      light: '#7c9cff',
      dark: '#1539a6',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#15b87a',
      light: '#6ee7b7',
      dark: '#08734c',
      contrastText: '#071411',
    },
    error: {
      main: '#dc2626', // Red
      light: '#f87171',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#f59e0b',
      light: '#fcd34d',
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
      main: '#0ea5a6',
      light: '#5eead4',
      dark: '#0f766e',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f6f7f9',
      paper: '#ffffff',
    },
    text: {
      primary: '#101820',
      secondary: '#5f6b76',
      disabled: '#98a1ab',
    },
    divider: '#e4e7eb',
    action: {
      hover: 'rgba(47, 91, 234, 0.07)',
      selected: 'rgba(47, 91, 234, 0.12)',
      disabled: 'rgba(16, 24, 32, 0.24)',
      disabledBackground: 'rgba(16, 24, 32, 0.10)',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    // Responsive typography with mobile-first approach
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: 0,
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
      letterSpacing: 0,
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
      letterSpacing: 0,
      lineHeight: 1.4,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
  },
  shape: {
    borderRadius: 8,
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
          backgroundColor: '#ffffff',
          boxShadow: '0 14px 36px -30px rgb(16 24 32 / 0.55)',
          borderRadius: 8,
          border: `1px solid ${theme.palette.divider}`,
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
          '&:hover': {
            boxShadow: '0 20px 48px -34px rgb(16 24 32 / 0.65)',
            borderColor: 'rgba(47, 91, 234, 0.28)',
          },
          [theme.breakpoints.down('sm')]: {
            borderRadius: 8,
          },
        }),
      },
    },

    // Enhanced Button component with mobile optimization
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 700,
          minHeight: 44,
          padding: theme.spacing(1.5, 3),
          transition: 'background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
          // Mobile optimizations
          [theme.breakpoints.down('sm')]: {
            minHeight: 48,
            padding: theme.spacing(2, 3),
            fontSize: '1rem',
            borderRadius: 8,
          },
        }),
        containedPrimary: {
          backgroundColor: '#2f5bea',
          boxShadow: '0 12px 24px -16px rgb(47 91 234 / 0.85)',
          '&:hover': {
            backgroundColor: '#244bd4',
            boxShadow: '0 18px 32px -18px rgb(47 91 234 / 0.9)',
          },
        },
        outlined: {
          borderWidth: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.64)',
          '&:hover': {
            borderWidth: 1,
          },
        },
      },
    },

    // Enhanced TextField component for mobile
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
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
          borderRadius: 8,
          transition: 'background-color 0.2s ease',
          [theme.breakpoints.down('sm')]: {
            minWidth: 48,
            minHeight: 48,
            padding: theme.spacing(1.25),
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
          borderRadius: 999,
          fontWeight: 700,
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
          boxShadow: 'none',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
        }),
      },
    },

    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 8,
        },
        root: {
          backgroundImage: 'none',
        },
      },
    },

    // Enhanced Drawer for mobile
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: '8px 0 0 8px',
          [theme.breakpoints.down('sm')]: {
            borderRadius: '8px 0 0 8px',
          },
        }),
      },
    },

    // Enhanced Dialog for mobile
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 8,
          boxShadow: '0 10px 30px -6px rgb(15 23 42 / 0.15)',
          margin: theme.spacing(2),
          [theme.breakpoints.down('sm')]: {
            borderRadius: 8,
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
              borderRadius: 8,
              fontSize: '0.9375rem',
            },
          },
        }),
      },
    },
  },
});

export default theme;
