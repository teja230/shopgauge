/**
 * Performance optimization utilities for admin components
 * Reduces CSS-in-JS runtime overhead and improves rendering performance
 */

import type { Theme } from '@mui/material/styles';
import { useMemo } from 'react';

// Pre-computed style objects to reduce runtime calculations
export const ADMIN_STYLES = {
  // Layout styles
  layout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--admin-bg-default)',
  },
  
  sidebar: {
    width: 'var(--admin-sidebar-width-expanded)',
    backgroundColor: 'var(--admin-sidebar-bg)',
    borderRight: '1px solid var(--admin-sidebar-border)',
    boxShadow: 'var(--admin-sidebar-shadow)',
    transition: 'width var(--admin-transition-base)',
    overflow: 'hidden',
  },
  
  sidebarCollapsed: {
    width: 'var(--admin-sidebar-width-collapsed)',
  },
  
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
  },
  
  header: {
    height: 'var(--admin-header-height)',
    backgroundColor: 'var(--admin-header-bg)',
    borderBottom: '1px solid var(--admin-header-border)',
    boxShadow: 'var(--admin-header-shadow)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--admin-space-6)',
    zIndex: 'var(--admin-z-sticky)',
  },
  
  content: {
    flex: 1,
    padding: 'var(--admin-content-padding)',
    backgroundColor: 'var(--admin-content-bg)',
    overflowY: 'auto' as const,
  },
  
  contentWrapper: {
    maxWidth: 'var(--admin-content-max-width)',
    margin: '0 auto',
    width: '100%',
  },
  
  // Card styles
  card: {
    backgroundColor: 'var(--admin-card-bg)',
    border: '1px solid var(--admin-card-border)',
    borderRadius: 'var(--admin-card-radius)',
    boxShadow: 'var(--admin-card-shadow)',
    padding: 'var(--admin-card-padding)',
    transition: 'box-shadow var(--admin-transition-base)',
  },
  
  cardHover: {
    boxShadow: 'var(--admin-card-shadow-hover)',
  },
  
  // Table styles
  tableContainer: {
    backgroundColor: 'var(--admin-card-bg)',
    border: '1px solid var(--admin-table-border)',
    borderRadius: 'var(--admin-card-radius)',
    boxShadow: 'var(--admin-card-shadow)',
    overflow: 'hidden',
  },
  
  tableHeader: {
    backgroundColor: 'var(--admin-table-header-bg)',
    borderBottom: '1px solid var(--admin-table-border)',
  },
  
  tableHeaderCell: {
    height: 'var(--admin-table-header-height)',
    padding: '0 var(--admin-space-4)',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  
  tableRow: {
    borderBottom: '1px solid var(--admin-table-border)',
    transition: 'background-color var(--admin-transition-fast)',
    '&:hover': {
      backgroundColor: 'var(--admin-table-row-hover)',
    },
  },
  
  tableCell: {
    height: 'var(--admin-table-row-height)',
    padding: '0 var(--admin-space-4)',
    color: 'var(--admin-text-primary)',
    verticalAlign: 'middle',
  },
  
  // Button styles
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--admin-space-2)',
    height: 'var(--admin-button-height)',
    padding: 'var(--admin-button-padding-y) var(--admin-button-padding-x)',
    border: 'none',
    borderRadius: 'var(--admin-button-radius)',
    fontSize: 'var(--admin-font-size-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--admin-transition-base)',
    minWidth: 'var(--admin-space-20)',
  },
  
  buttonPrimary: {
    backgroundColor: 'var(--admin-primary)',
    color: 'var(--admin-white)',
    boxShadow: 'var(--admin-shadow-sm)',
    '&:hover:not(:disabled)': {
      backgroundColor: 'var(--admin-primary-dark)',
      boxShadow: 'var(--admin-shadow-md)',
      transform: 'translateY(-1px)',
    },
  },
  
  // Status styles
  statusHealthy: {
    backgroundColor: 'var(--admin-success-100)',
    color: 'var(--admin-success-800)',
    border: '1px solid var(--admin-success-200)',
  },
  
  statusWarning: {
    backgroundColor: 'var(--admin-warning-100)',
    color: 'var(--admin-warning-800)',
    border: '1px solid var(--admin-warning-200)',
  },
  
  statusError: {
    backgroundColor: 'var(--admin-error-100)',
    color: 'var(--admin-error-800)',
    border: '1px solid var(--admin-error-200)',
  },
  
  statusInfo: {
    backgroundColor: 'var(--admin-info-100)',
    color: 'var(--admin-info-800)',
    border: '1px solid var(--admin-info-200)',
  },
} as const;

// Responsive breakpoints as constants
export const ADMIN_BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

// Media query helpers
export const useResponsiveStyles = () => {
  return useMemo(() => ({
    mobile: `@media (max-width: ${ADMIN_BREAKPOINTS.md - 1}px)`,
    tablet: `@media (min-width: ${ADMIN_BREAKPOINTS.md}px) and (max-width: ${ADMIN_BREAKPOINTS.lg - 1}px)`,
    desktop: `@media (min-width: ${ADMIN_BREAKPOINTS.lg}px)`,
    largeDesktop: `@media (min-width: ${ADMIN_BREAKPOINTS.xl}px)`,
  }), []);
};

// Theme-aware style generator with memoization
export const useAdminThemeStyles = (theme: Theme) => {
  return useMemo(() => ({
    // Combine CSS custom properties with theme values for fallbacks
    primary: theme.palette.primary.main || 'var(--admin-primary)',
    secondary: theme.palette.secondary.main || 'var(--admin-grey-500)',
    success: theme.palette.success.main || 'var(--admin-success)',
    warning: theme.palette.warning.main || 'var(--admin-warning)',
    error: theme.palette.error.main || 'var(--admin-error)',
    info: theme.palette.info.main || 'var(--admin-info)',
    
    // Spacing using theme or fallback to CSS custom properties
    spacing: (multiplier: number) => 
      theme.spacing ? theme.spacing(multiplier) : `calc(var(--admin-space-2) * ${multiplier})`,
    
    // Typography with fallbacks
    typography: {
      fontFamily: theme.typography.fontFamily || 'var(--admin-font-family)',
      h1: {
        fontSize: theme.typography.h1?.fontSize || 'var(--admin-font-size-4xl)',
        fontWeight: theme.typography.h1?.fontWeight || 'var(--admin-font-weight-bold)',
        lineHeight: theme.typography.h1?.lineHeight || 'var(--admin-line-height-tight)',
      },
      h2: {
        fontSize: theme.typography.h2?.fontSize || 'var(--admin-font-size-3xl)',
        fontWeight: theme.typography.h2?.fontWeight || 'var(--admin-font-weight-semibold)',
        lineHeight: theme.typography.h2?.lineHeight || 'var(--admin-line-height-tight)',
      },
      h3: {
        fontSize: theme.typography.h3?.fontSize || 'var(--admin-font-size-2xl)',
        fontWeight: theme.typography.h3?.fontWeight || 'var(--admin-font-weight-semibold)',
        lineHeight: theme.typography.h3?.lineHeight || 'var(--admin-line-height-snug)',
      },
      body1: {
        fontSize: theme.typography.body1?.fontSize || 'var(--admin-font-size-base)',
        fontWeight: theme.typography.body1?.fontWeight || 'var(--admin-font-weight-normal)',
        lineHeight: theme.typography.body1?.lineHeight || 'var(--admin-line-height-normal)',
      },
      body2: {
        fontSize: theme.typography.body2?.fontSize || 'var(--admin-font-size-sm)',
        fontWeight: theme.typography.body2?.fontWeight || 'var(--admin-font-weight-normal)',
        lineHeight: theme.typography.body2?.lineHeight || 'var(--admin-line-height-normal)',
      },
    },
    
    // Shadows with fallbacks
    shadows: {
      xs: theme.shadows?.[1] || 'var(--admin-shadow-xs)',
      sm: theme.shadows?.[2] || 'var(--admin-shadow-sm)',
      md: theme.shadows?.[4] || 'var(--admin-shadow-md)',
      lg: theme.shadows?.[8] || 'var(--admin-shadow-lg)',
      xl: theme.shadows?.[12] || 'var(--admin-shadow-xl)',
    },
    
    // Border radius with fallbacks
    borderRadius: {
      sm: theme.shape?.borderRadius && typeof theme.shape.borderRadius === 'number' 
        ? `${theme.shape.borderRadius * 0.5}px` : 'var(--admin-radius-sm)',
      md: theme.shape?.borderRadius && typeof theme.shape.borderRadius === 'number'
        ? `${theme.shape.borderRadius}px` : 'var(--admin-radius-md)',
      lg: theme.shape?.borderRadius && typeof theme.shape.borderRadius === 'number'
        ? `${theme.shape.borderRadius * 2}px` : 'var(--admin-radius-lg)',
      xl: theme.shape?.borderRadius && typeof theme.shape.borderRadius === 'number'
        ? `${theme.shape.borderRadius * 3}px` : 'var(--admin-radius-xl)',
    },
  }), [theme]);
};

// Performance monitoring utilities
export const performanceMonitor = {
  // Mark performance milestones
  mark: (name: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`admin-${name}`);
    }
  },
  
  // Measure performance between marks
  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(
          `admin-${name}`, 
          `admin-${startMark}`, 
          endMark ? `admin-${endMark}` : undefined
        );
      } catch (error) {
        console.warn('Performance measurement failed:', error);
      }
    }
  },
  
  // Get performance entries
  getEntries: (name?: string) => {
    if (typeof performance !== 'undefined' && performance.getEntriesByName) {
      return name 
        ? performance.getEntriesByName(`admin-${name}`)
        : performance.getEntriesByType('measure').filter(entry => 
            entry.name.startsWith('admin-')
          );
    }
    return [];
  },
  
  // Clear performance entries
  clear: () => {
    if (typeof performance !== 'undefined' && performance.clearMarks) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  },
};

// Bundle size optimization helpers
export const lazyImportWithRetry = async <T>(
  importFn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  try {
    return await importFn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return lazyImportWithRetry(importFn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Memory optimization utilities
export const memoryOptimizer = {
  // Cleanup function for component unmount
  cleanup: (refs: React.RefObject<any>[]) => {
    refs.forEach(ref => {
      if (ref.current) {
        // Clear any event listeners or observers
        if (ref.current.removeEventListener) {
          // Generic cleanup - specific implementations should handle their own cleanup
        }
      }
    });
  },
  
  // Debounce function with cleanup
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): T & { cancel: () => void } => {
    let timeout: NodeJS.Timeout;
    
    const debounced = ((...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T & { cancel: () => void };
    
    debounced.cancel = () => clearTimeout(timeout);
    
    return debounced;
  },
  
  // Throttle function for high-frequency events
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T => {
    let inThrottle: boolean;
    
    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  },
};