import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery,
  IconButton,
  Box,
} from '@mui/material';
import {
  LayoutDashboard as DashboardIcon,
  HeartPulse as HealthIcon,
  Users as PeopleIcon,
  ShieldCheck as SecurityIcon,
  Monitor as MonitoringIcon,
  Settings as SettingsIcon,
  ChevronUp as ExpandLess,
  ChevronDown as ExpandMore,
  Database as StorageIcon,
  AlertTriangle as WarningIcon,
  ClipboardList as AssessmentIcon,
  UserCog as AdminIcon,
  Activity as TimelineIcon,
  Bug as BugIcon,
  X as CloseIcon,
  Gauge as SpeedIcon,
  MemoryStick as MemoryIcon,
} from 'lucide-react';
import { useAdminNavigation } from '../../context/AdminNavigationContext';
import { useKeyboardNavigation, useFocusAnnouncement } from '../../hooks/useKeyboardNavigation';
import type { NavigationSection } from '../../context/AdminNavigationContext';



interface AdminSidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  activeSection?: string;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onSectionChange?: (section: string) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isCollapsed = false,
  onToggle = () => undefined,
  activeSection = 'dashboard',
  isMobile = false,
  mobileOpen = false,
  onSectionChange = () => undefined,
}) => {
  const theme = useTheme();
  const { setActiveSection, setBreadcrumbs } = useAdminNavigation();
  const [expandedSections, setExpandedSections] = useState<string[]>(['system-health', 'user-management']);
  const { announce } = useFocusAnnouncement();
  
  // Keyboard navigation setup
  const { containerRef } = useKeyboardNavigation({
    enableArrowNavigation: true,
    enableTabTrapping: isMobile && mobileOpen,
    onEscape: isMobile ? onToggle : undefined,
  });

  // Enhanced navigation configuration with proper hierarchy
  const navigationSections: NavigationSection[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
    },
    {
      id: 'system-health',
      label: 'System Health',
      icon: <HealthIcon />,
      children: [
        { id: 'health-summary', label: 'Health Summary', icon: <AssessmentIcon />, path: '/admin/health' },
        { id: 'connection-pool', label: 'Connection Pool', icon: <StorageIcon />, path: '/admin/connection-pool' },
        { id: 'emergency-status', label: 'Emergency Status', icon: <WarningIcon />, path: '/admin/emergency' },
      ],
    },
    {
      id: 'user-management',
      label: 'User Management',
      icon: <PeopleIcon />,
      children: [
        { id: 'active-sessions', label: 'Active Sessions', icon: <TimelineIcon />, path: '/admin/sessions' },
        { id: 'deleted-shops', label: 'Deleted Shops', icon: <StorageIcon />, path: '/admin/deleted-shops' },
      ],
    },
    {
      id: 'security-audit',
      label: 'Security & Audit',
      icon: <SecurityIcon />,
      children: [
        { id: 'audit-logs', label: 'Audit Logs', icon: <AssessmentIcon />, path: '/admin/audit-logs' },
        { id: 'security-dashboard', label: 'Security Dashboard', icon: <SecurityIcon />, path: '/admin/security' },
        { id: 'rate-limiting', label: 'Rate Limiting', icon: <AdminIcon />, path: '/admin/rate-limiting' },
      ],
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      icon: <MonitoringIcon />,
      children: [
        { id: 'comprehensive-monitoring', label: 'Comprehensive Monitoring', icon: <MonitoringIcon />, path: '/admin/monitoring' },
        { id: 'transaction-monitoring', label: 'Transaction Monitoring', icon: <TimelineIcon />, path: '/admin/transactions' },
        { id: 'performance-metrics', label: 'Performance Metrics', icon: <SpeedIcon />, path: '/admin/performance' },
        { id: 'sse-statistics', label: 'SSE Statistics', icon: <AssessmentIcon />, path: '/admin/sse-stats' },
        { id: 'market-intelligence', label: 'Market Intelligence', icon: <AssessmentIcon />, path: '/admin/market-intelligence' },
        { id: 'market-intelligence-optimization', label: 'Market Intelligence Optimization', icon: <SettingsIcon />, path: '/admin/market-intelligence-optimization' },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon />,
      children: [
        { id: 'memory-optimization', label: 'Memory Optimization', icon: <MemoryIcon />, path: '/admin/memory-optimization' },
        { id: 'debug-panel', label: 'Debug Panel', icon: <BugIcon />, path: '/admin/debug' },
        { id: 'system-configuration', label: 'System Configuration', icon: <SettingsIcon />, path: '/admin/config' },
      ],
    },
  ];

  const handleSectionClick = (section: NavigationSection) => {
    if (section.children) {
      // Toggle expansion for sections with children
      const wasExpanded = expandedSections.includes(section.id);
      setExpandedSections(prev =>
        prev.includes(section.id)
          ? prev.filter(id => id !== section.id)
          : [...prev, section.id]
      );
      
      // Announce state change for screen readers
      announce(
        `${section.label} section ${wasExpanded ? 'collapsed' : 'expanded'}`,
        'polite'
      );
    } else {
      // Navigate to section without children (like Dashboard)
      setActiveSection(section.id);
      setBreadcrumbs([{ label: section.label, icon: section.icon }]);
      onSectionChange(section.id); // Notify parent component
      
      // Announce navigation for screen readers
      announce(`Navigated to ${section.label}`, 'polite');
      
      if (isMobile) {
        onToggle(); // Close sidebar on mobile after selection
      }
    }
  };

  const handleItemClick = (item: any, parentSection: NavigationSection) => {
    setActiveSection(item.id);
    setBreadcrumbs([
      { label: parentSection.label, icon: parentSection.icon },
      { label: item.label, icon: item.icon },
    ]);
    onSectionChange(item.id); // Notify parent component
    
    // Announce navigation for screen readers
    announce(`Navigated to ${item.label} in ${parentSection.label}`, 'polite');
    
    if (isMobile) {
      onToggle(); // Close sidebar on mobile after selection
    }
  };

  const renderNavigationItem = (section: NavigationSection) => {
    const isExpanded = expandedSections.includes(section.id);
    const isActive = activeSection === section.id;
    
    // Check if any child is active to highlight parent section
    const hasActiveChild = section.children?.some(child => activeSection === child.id) || false;
    const shouldHighlightParent = isActive || hasActiveChild;

    return (
      <div key={section.id} role="none">
        <Tooltip
          title={isCollapsed ? section.label : ''}
          placement="right"
          disableHoverListener={!isCollapsed}
        >
          <button
            type="button"
            className={`admin-nav__item admin-interactive ${shouldHighlightParent ? 'admin-nav__item--active' : ''}`}
            onClick={() => handleSectionClick(section)}
            role={section.children ? 'button' : 'menuitem'}
            aria-expanded={section.children ? isExpanded : undefined}
            aria-controls={section.children ? `submenu-${section.id}` : undefined}
            aria-current={isActive ? 'page' : undefined}
            aria-label={
              section.children 
                ? `${section.label} section, ${isExpanded ? 'expanded' : 'collapsed'}`
                : section.label
            }
            tabIndex={0}
          >
            <div className="admin-nav__icon" aria-hidden="true">
              {section.badge ? (
                <Badge 
                  badgeContent={section.badge} 
                  color="error"
                  aria-label={`${section.badge} notifications`}
                >
                  {section.icon}
                </Badge>
              ) : (
                section.icon
              )}
            </div>
            {!isCollapsed && (
              <>
                <span className="admin-nav__label">
                  {section.label}
                </span>
                {section.children && (
                  <div className="admin-nav__icon" aria-hidden="true">
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </div>
                )}
              </>
            )}
          </button>
        </Tooltip>

        {/* Render children if section is expanded and not collapsed */}
        {section.children && !isCollapsed && (
          <div 
            className="admin-nav__submenu"
            id={`submenu-${section.id}`}
            role="menu"
            aria-label={`${section.label} submenu`}
            style={{ display: isExpanded ? 'block' : 'none' }}
          >
            {section.children.map((item) => (
              <Tooltip
                key={item.id}
                title={isCollapsed ? item.label : ''}
                placement="right"
                disableHoverListener={!isCollapsed}
              >
                <button
                  type="button"
                  className={`admin-nav__item admin-nav__item--child admin-interactive ${activeSection === item.id ? 'admin-nav__item--active' : ''}`}
                  onClick={() => handleItemClick(item, section)}
                  role="menuitem"
                  aria-current={activeSection === item.id ? 'page' : undefined}
                  aria-label={item.label}
                  tabIndex={0}
                >
                  <div className="admin-nav__icon" aria-hidden="true">
                    {item.badge ? (
                      <Badge 
                        badgeContent={item.badge} 
                        color="error"
                        aria-label={`${item.badge} notifications`}
                      >
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </div>
                  <span className="admin-nav__label">
                    {item.label}
                  </span>
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div 
      className="admin-sidebar__content"
      ref={containerRef as React.RefObject<HTMLDivElement>}
      role="navigation"
      aria-label="Admin navigation"
    >
      {/* Mobile header with close button */}
      {isMobile && (
        <div className="admin-sidebar__mobile-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--admin-space-2)' }}>
            <AdminIcon color="#2f5bea" aria-hidden="true" />
            <h2 className="admin-sidebar__mobile-title" id="sidebar-title">
              Admin Panel
            </h2>
          </div>
          <IconButton
            className="admin-sidebar__mobile-close"
            onClick={onToggle}
            size="small"
            aria-label="Close admin navigation sidebar"
          >
            <CloseIcon />
          </IconButton>
        </div>
      )}

      {/* Desktop header */}
      {!isMobile && (
        <div className="admin-sidebar__header">
          <AdminIcon color="#2f5bea" aria-hidden="true" />
          {!isCollapsed && (
            <h2 className="admin-sidebar__title" id="sidebar-title">
              Admin Panel
            </h2>
          )}
        </div>
      )}

      <nav 
        className="admin-nav"
        role="menubar"
        aria-labelledby="sidebar-title"
        aria-orientation="vertical"
      >
        {navigationSections.map(renderNavigationItem)}
      </nav>
    </div>
  );

  return (
    <div className={`admin-sidebar ${isCollapsed ? 'admin-sidebar--collapsed' : ''}`}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={isMobile ? onToggle : undefined}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? 280 : isCollapsed ? 64 : 280,
            boxSizing: 'border-box',
            backgroundColor: 'var(--admin-sidebar-bg)',
            borderRight: `1px solid var(--admin-sidebar-border)`,
            boxShadow: 'var(--admin-sidebar-shadow)',
            transition: 'width var(--admin-transition-base)',
            overflowX: 'hidden',
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    </div>
  );
};

export default AdminSidebar;
