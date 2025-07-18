import React, { useState, useCallback } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  HealthAndSafety as HealthIcon,
  Storage as StorageIcon,
  Emergency as EmergencyIcon,
  People as PeopleIcon,
  Timeline as TimelineIcon,
  Store as StoreIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Monitor as MonitorIcon,
  Settings as SettingsIcon,
  BugReport as DebugIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { NotificationCenter } from './NotificationCenter';
import '../../styles/admin-design-system.css';

interface AdminUser {
  username: string;
  role: string;
  lastLogin?: Date;
}

interface BreadcrumbItem {
  label: string;
  icon?: React.ReactNode;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  currentSection: string;
  onSectionChange: (section: string) => void;
  breadcrumbs: BreadcrumbItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
  user?: AdminUser;
  onLogout?: () => void;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
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
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [expandedSections, setExpandedSections] = useState<string[]>(['system-health', 'user-management', 'security-audit', 'monitoring', 'settings']);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Navigation structure matching main branch
  const navigationItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <DashboardIcon />,
      section: 'dashboard',
    },
    {
      id: 'system-health',
      label: 'System Health',
      icon: <HealthIcon />,
      expanded: expandedSections.includes('system-health'),
      children: [
        { id: 'health-summary', label: 'Health Summary', section: 'health-summary' },
        { id: 'connection-pool', label: 'Connection Pool', section: 'connection-pool' },
        { id: 'emergency-status', label: 'Emergency Status', section: 'emergency-status' },
      ],
    },
    {
      id: 'user-management',
      label: 'User Management',
      icon: <PeopleIcon />,
      expanded: expandedSections.includes('user-management'),
      children: [
        { id: 'active-sessions', label: 'Active Sessions', section: 'active-sessions' },
        { id: 'session-statistics', label: 'Session Statistics', section: 'session-statistics' },
        { id: 'deleted-shops', label: 'Deleted Shops', section: 'deleted-shops' },
        { id: 'session-management', label: 'Session Management', section: 'session-management' },
      ],
    },
    {
      id: 'security-audit',
      label: 'Security & Audit',
      icon: <SecurityIcon />,
      expanded: expandedSections.includes('security-audit'),
      children: [
        { id: 'security-dashboard', label: 'Security Dashboard', section: 'security-dashboard' },
        { id: 'rate-limiting', label: 'Rate Limiting', section: 'rate-limiting' },
        { id: 'audit-logs', label: 'Audit Logs', section: 'audit-logs' },
      ],
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      icon: <MonitorIcon />,
      expanded: expandedSections.includes('monitoring'),
      children: [
        { id: 'comprehensive-monitoring', label: 'Comprehensive Monitoring', section: 'comprehensive-monitoring' },
        { id: 'transaction-monitoring', label: 'Transaction Monitoring', section: 'transaction-monitoring' },
        { id: 'sse-statistics', label: 'SSE Statistics', section: 'sse-statistics' },
      ],
    },
    {
      id: 'market-intelligence',
      label: 'Market Intelligence',
      icon: <AssessmentIcon />,
      section: 'market-intelligence',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon />,
      expanded: expandedSections.includes('settings'),
      children: [
        { id: 'system-configuration', label: 'System Configuration', section: 'system-configuration' },
      ],
    },
  ];

  const handleSectionToggle = useCallback((sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  const handleSectionClick = useCallback((section: string) => {
    onSectionChange(section);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [onSectionChange, isMobile]);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleLogout = () => {
    handleUserMenuClose();
    onLogout?.();
  };

  const renderNavigationItem = (item: any, level: number = 0) => {
    const isActive = currentSection === item.section;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = item.expanded;

    return (
      <Box key={item.id}>
        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                handleSectionToggle(item.id);
              } else {
                handleSectionClick(item.section);
              }
            }}
            selected={isActive}
            sx={{
              borderRadius: 1,
              mx: 1,
              mb: 0.5,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              },
            }}
          >
            <ListItemIcon sx={{ 
              color: isActive ? 'inherit' : 'text.secondary',
              minWidth: 40 
            }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label} 
              primaryTypographyProps={{ 
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400 
              }}
            />
            {hasChildren && (
              <IconButton size="small" sx={{ color: 'inherit' }}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </ListItemButton>
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children.map((child: any) => {
                const isChildActive = currentSection === child.section;
                return (
                  <ListItem key={child.id} disablePadding sx={{ pl: 4 }}>
                    <ListItemButton
                      onClick={() => handleSectionClick(child.section)}
                      selected={isChildActive}
                      sx={{
                        borderRadius: 1,
                        mx: 1,
                        mb: 0.5,
                        '&.Mui-selected': {
                          backgroundColor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': {
                            backgroundColor: 'primary.dark',
                          },
                        },
                      }}
                    >
                      <ListItemText 
                        primary={child.label} 
                        primaryTypographyProps={{ 
                          fontSize: '0.8rem',
                          fontWeight: isChildActive ? 600 : 400 
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Collapse>
        )}
      </Box>
    );
  };

  const drawerWidth = 280;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <AdminIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
              Admin Panel
            </Typography>
      
            {/* Breadcrumbs */}
            <Box sx={{ ml: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <Typography variant="body2" color="text.secondary">/</Typography>}
                  <Typography 
                    variant="body2" 
                    color={index === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                    sx={{ fontWeight: index === breadcrumbs.length - 1 ? 600 : 400 }}
                  >
                    {crumb.label}
                  </Typography>
                </React.Fragment>
              ))}
            </Box>
          </Box>

          {/* Right side actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Refresh Button */}
            {onRefresh && (
              <Tooltip title="Refresh">
                <IconButton
                  color="inherit"
                  onClick={onRefresh}
                  disabled={refreshing}
                  sx={{ 
                    '&:hover': { backgroundColor: 'action.hover' },
                    '&.Mui-disabled': { opacity: 0.5 }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}

            {/* Notification Center */}
            <Box sx={{ mr: 1 }}>
              <NotificationCenter />
            </Box>

            {/* User Menu */}
            <Tooltip title={user?.username || 'Admin'}>
              <IconButton
                color="inherit"
                onClick={handleUserMenuOpen}
                sx={{ 
                  '&:hover': { backgroundColor: 'action.hover' }
                }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  {user?.username?.charAt(0).toUpperCase() || 'A'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        
        <Box sx={{ overflow: 'auto', py: 2 }}>
          <List>
            {navigationItems.map(item => renderNavigationItem(item))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
            {children}
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem disabled>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="subtitle2">{user?.username || 'Admin'}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.role || 'Administrator'}</Typography>
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AdminLayout;