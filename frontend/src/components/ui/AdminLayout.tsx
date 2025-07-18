import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import {
  useTheme,
  useMediaQuery,
} from '@mui/material';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import { AdminNavigationProvider, useAdminNavigation } from '../../context/AdminNavigationContext';
import { useKeyboardNavigation, useFocusAnnouncement, ADMIN_KEYBOARD_SHORTCUTS } from '../../hooks/useKeyboardNavigation';
import { ADMIN_STYLES, useAdminThemeStyles, performanceMonitor } from '../../utils/performanceOptimizations';
import type { BreadcrumbItem } from '../../context/AdminNavigationContext';
import type { KeyboardShortcut } from '../../hooks/useKeyboardNavigation';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentSection: string;
  onSectionChange: (section: string) => void;
  breadcrumbs?: BreadcrumbItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
  user?: {
    username: string;
    role: string;
    lastLogin?: Date;
  };
  onLogout: () => void;
}

const AdminLayoutContent: React.FC<AdminLayoutProps> = memo(({
  children,
  currentSection,
  onSectionChange,
  breadcrumbs,
  onRefresh,
  refreshing = false,
  user,
  onLogout,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { state, setSidebarCollapsed, setActiveSection, setBreadcrumbs } = useAdminNavigation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const { announce, AnnouncementRegion } = useFocusAnnouncement();
  
  // Performance monitoring
  useEffect(() => {
    performanceMonitor.mark('admin-layout-mount');
    return () => {
      performanceMonitor.mark('admin-layout-unmount');
      performanceMonitor.measure('admin-layout-lifecycle', 'admin-layout-mount', 'admin-layout-unmount');
    };
  }, []);

  // Memoize theme styles to prevent recalculation
  const themeStyles = useAdminThemeStyles(theme);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setMobileDrawerOpen(!mobileDrawerOpen);
    } else {
      const newCollapsed = !state.sidebarCollapsed;
      setSidebarCollapsed(newCollapsed);
    }
  }, [isMobile, mobileDrawerOpen, state.sidebarCollapsed, setSidebarCollapsed]);

  const handleSectionChange = useCallback((section: string) => {
    onSectionChange(section);
    // Close mobile drawer after selection
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [onSectionChange, isMobile]);

  const handleMobileOverlayClick = useCallback(() => {
    if (isMobile && mobileDrawerOpen) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile, mobileDrawerOpen]);

  // Memoize keyboard shortcuts to prevent recreation on every render
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.TOGGLE_SIDEBAR,
      action: () => {
        handleSidebarToggle();
        announce(
          isMobile 
            ? `Navigation ${mobileDrawerOpen ? 'closed' : 'opened'}`
            : `Sidebar ${state.sidebarCollapsed ? 'expanded' : 'collapsed'}`,
          'polite'
        );
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.REFRESH_DATA,
      action: () => {
        if (onRefresh && !refreshing) {
          onRefresh();
          announce('Refreshing data', 'polite');
        }
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.HELP,
      action: () => {
        setShowKeyboardHelp(true);
        announce('Keyboard shortcuts help opened', 'polite');
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.DASHBOARD,
      action: () => {
        setActiveSection('dashboard');
        setBreadcrumbs([{ label: 'Dashboard', icon: null }]);
        onSectionChange('dashboard');
        announce('Navigated to Dashboard', 'polite');
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.HEALTH,
      action: () => {
        setActiveSection('health-summary');
        onSectionChange('health-summary');
        announce('Navigated to Health Summary', 'polite');
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.SESSIONS,
      action: () => {
        setActiveSection('active-sessions');
        onSectionChange('active-sessions');
        announce('Navigated to Active Sessions', 'polite');
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.AUDIT,
      action: () => {
        setActiveSection('audit-logs');
        onSectionChange('audit-logs');
        announce('Navigated to Audit Logs', 'polite');
      },
    },
    {
      ...ADMIN_KEYBOARD_SHORTCUTS.MONITORING,
      action: () => {
        setActiveSection('comprehensive-monitoring');
        onSectionChange('comprehensive-monitoring');
        announce('Navigated to Monitoring', 'polite');
      },
    },
  ], [handleSidebarToggle, announce, isMobile, mobileDrawerOpen, state.sidebarCollapsed, onRefresh, refreshing, setActiveSection, setBreadcrumbs, onSectionChange]);

  // Set up keyboard navigation
  const { containerRef } = useKeyboardNavigation({
    shortcuts: keyboardShortcuts,
    onEscape: () => {
      if (showKeyboardHelp) {
        setShowKeyboardHelp(false);
        announce('Keyboard shortcuts help closed', 'polite');
      } else if (isMobile && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
        announce('Navigation closed', 'polite');
      }
    },
  });

  // Handle mobile responsiveness
  useEffect(() => {
    if (isMobile) {
      // On mobile, always use drawer mode
      setMobileDrawerOpen(false);
    } else {
      // On desktop/tablet, use persistent sidebar
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  return (
    <div 
      className="admin-layout admin-container"
      ref={containerRef as React.RefObject<HTMLDivElement>}
      role="application"
      aria-label="Admin interface"
      style={ADMIN_STYLES.layout}
    >
      {/* Screen reader announcements */}
      <div
        ref={AnnouncementRegion().announcementRef}
        aria-live="polite"
        aria-atomic="true"
        className="admin-sr-only"
        role="status"
      />
      
      {/* Mobile overlay */}
      {isMobile && mobileDrawerOpen && (
        <div 
          className={`admin-mobile-overlay ${mobileDrawerOpen ? 'admin-mobile-overlay--visible' : ''}`}
          onClick={handleMobileOverlayClick}
          aria-hidden="true"
        />
      )}
      
      <AdminSidebar
        isCollapsed={isMobile ? false : state.sidebarCollapsed}
        onToggle={handleSidebarToggle}
        activeSection={currentSection}
        isMobile={isMobile}
        mobileOpen={mobileDrawerOpen}
        onSectionChange={handleSectionChange}
      />
      
      <div className="admin-main" style={ADMIN_STYLES.main}>
        <AdminHeader
          breadcrumbs={breadcrumbs || state.breadcrumbs}
          onRefresh={onRefresh}
          refreshing={refreshing}
          notifications={state.notifications}
          user={user || state.user}
          onLogout={onLogout}
          onMenuClick={handleSidebarToggle}
          showMenuButton={isMobile}
        />
        
        <main className="admin-content" role="main" aria-label="Main content" style={ADMIN_STYLES.content}>
          <div className="admin-content-wrapper" style={ADMIN_STYLES.contentWrapper}>
            {children}
          </div>
        </main>
      </div>

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsHelp
        open={showKeyboardHelp}
        onClose={useCallback(() => {
          setShowKeyboardHelp(false);
          announce('Keyboard shortcuts help closed', 'polite');
        }, [announce])}
        shortcuts={keyboardShortcuts}
      />
    </div>
  );
});

const AdminLayout: React.FC<AdminLayoutProps> = (props) => {
  return (
    <AdminNavigationProvider>
      <AdminLayoutContent {...props} />
    </AdminNavigationProvider>
  );
};

export default AdminLayout;