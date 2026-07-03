import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Insights as InsightsIcon,
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  AutoAwesome as IntelligenceIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './ui/NotificationCenter';
import { adminLogout, getAdminStatus } from '../api/admin';
import { getSuggestionCount } from '../api';

const NavBar: React.FC = () => {
  const { isAuthenticated, logout, isDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const handleLogout = () => {
    // Handle regular logout
    logout();
  };

  const handleExitDemo = () => {
    localStorage.removeItem('demo_mode_active');
    sessionStorage.removeItem('demo_mode_active');
    sessionStorage.removeItem('demo_session_started');
    navigate('/');
  };

  // Admin-specific functions
  const checkAuthStatus = async () => {
    try {
      const status = await getAdminStatus();
      console.log('Admin auth status:', status);
    } catch (error) {
      console.error('Failed to check admin auth status:', error);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await adminLogout();
      navigate('/');
    } catch (error) {
      console.error('Failed to logout admin:', error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Fetch suggestion count ONLY on initial load - NO POLLING (on-demand only)
  useEffect(() => {
    if (isAuthenticated) {
      const fetchSuggestionCount = async () => {
        try {
          // Only fetch if cache is expired (24 hours) or no data
          const now = Date.now();
          const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for costly APIs

          if (now - lastFetchTime < CACHE_DURATION && suggestionCount > 0) {
            return; // Use cached value
          }

          const response = await getSuggestionCount();
          setSuggestionCount(response.newSuggestions);
          setLastFetchTime(now);
        } catch (error) {
          console.error('Error fetching suggestion count:', error);
          // Don't reset to 0 on error, keep last known value
        }
      };

      // ONLY initial fetch - NO BACKGROUND POLLING to prevent costly API calls
      // Users must navigate to competitors page or refresh manually for updates
      fetchSuggestionCount();
    } else {
      setSuggestionCount(0);
      setLastFetchTime(0);
    }
  }, [isAuthenticated]); // Removed polling dependencies

  const showAdmin = location.pathname.startsWith('/admin');
  const appShellActive =
    isAuthenticated ||
    isDemoMode ||
    localStorage.getItem('demo_mode_active') === 'true' ||
    new URLSearchParams(location.search).get('demo') === 'true';

  const menuItems = appShellActive ? [
    {
      text: 'Home',
      icon: <HomeIcon />,
      path: '/?force=true',
      badge: 0
    },
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      badge: 0
    },
    {
      text: 'Market Intelligence',
      icon: <BusinessIcon />,
      path: '/competitors',
      badge: suggestionCount
    },
    {
      text: 'ShopGPT',
      icon: <IntelligenceIcon />,
      path: '/business-intelligence',
      badge: 0
    },
    {
      text: 'Profile',
      icon: <PersonIcon />,
      path: '/profile',
      badge: 0
    }
  ] : [];

  const MobileDrawer = () => (
    <Drawer
      anchor="right"
      open={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          backgroundColor: '#101820',
          color: '#ffffff',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          backgroundColor: '#0b1016',
          color: '#ffffff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: '#2f5bea',
              color: '#ffffff',
              mr: 1.25,
            }}
          >
            <InsightsIcon sx={{ fontSize: 21 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            ShopGauge
          </Typography>
        </Box>
        <IconButton
          onClick={() => setMobileMenuOpen(false)}
          sx={{ color: 'white' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 1,
                color: '#c3ccd5',
                '& .MuiListItemIcon-root': {
                  color: 'inherit',
                  minWidth: 40,
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <ListItemIcon>
                {item.badge > 0 ? (
                  <Badge badgeContent={item.badge} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {appShellActive && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                borderColor: 'rgba(255,255,255,0.20)',
                color: '#ffffff',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.45)',
                  backgroundColor: 'rgba(255,255,255,0.10)',
                },
              }}
            >
              Logout
            </Button>
          </Box>
        </>
      )}

      {/* Admin-specific buttons in mobile menu */}
      {showAdmin && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={checkAuthStatus}
              sx={{ mb: 1 }}
            >
              Refresh Session
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleAdminLogout}
              sx={{
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                '&:hover': {
                  borderColor: theme.palette.error.dark,
                  backgroundColor: `${theme.palette.error.main}10`,
                },
              }}
            >
              Logout Admin
            </Button>
          </Box>
        </>
      )}
    </Drawer>
  );

  const BrandMark = ({ dark = false }: { dark?: boolean }) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => navigate(appShellActive ? '/dashboard' : '/')}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '10px',
          backgroundColor: dark ? '#2f5bea' : '#101820',
          color: '#ffffff',
          boxShadow: dark ? '0 16px 30px -22px rgba(47,91,234,0.7)' : '0 16px 30px -24px #101820',
        }}
      >
        <InsightsIcon sx={{ fontSize: 23 }} />
      </Box>
      <Box>
        <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: 0, lineHeight: 1.1 }}>
          ShopGauge
        </Typography>
        <Typography variant="caption" sx={{ color: dark ? '#8b96a2' : 'text.secondary', fontWeight: 700 }}>
          Commerce intelligence
        </Typography>
      </Box>
    </Box>
  );

  if (!appShellActive) {
    return (
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          bgcolor: 'rgba(251, 252, 247, 0.86)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'rgba(16, 24, 32, 0.08)',
          backdropFilter: 'blur(16px)',
          zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 4 } }}>
          <BrandMark />
          <Box sx={{ flexGrow: 1 }} />
          <Chip
            label="3-day trial"
            size="small"
            sx={{ bgcolor: '#e8edff', color: '#1d3db8', border: '1px solid #b3c4f5' }}
          />
        </Toolbar>
      </AppBar>
    );
  }

  if (!isMobile) {
    return (
      <Box
        component="aside"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 256,
          zIndex: (muiTheme) => muiTheme.zIndex.drawer + 2,
          bgcolor: '#0b1016',
          color: '#ffffff',
          borderRight: '1px solid rgba(255,255,255,0.10)',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
        }}
      >
        <Box sx={{ p: 1, pb: 3 }}>
          <BrandMark dark />
        </Box>

        <Box sx={{ px: 1, pb: 2 }}>
          <Typography variant="caption" sx={{ color: '#7f9188', fontWeight: 800, textTransform: 'uppercase' }}>
            Workspace
          </Typography>
        </Box>

        <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1, px: 0 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path.split('?')[0];
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  selected={isActive}
                  sx={{
                    borderRadius: 1,
                    minHeight: 46,
                    color: isActive ? '#ffffff' : '#b9c7c0',
                    '& .MuiListItemIcon-root': {
                      color: 'inherit',
                      minWidth: 38,
                    },
                    '&.Mui-selected': {
                      bgcolor: 'rgba(255, 255, 255, 0.12)',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.16)' },
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                    },
                  }}
                >
                  <ListItemIcon>
                    {item.badge > 0 ? (
                      <Badge badgeContent={item.badge} color="error">
                        {item.icon}
                      </Badge>
                    ) : (
                      item.icon
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 800 : 700 }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box
          sx={{
            border: '1px solid rgba(255,255,255,0.10)',
            bgcolor: 'rgba(255,255,255,0.05)',
            borderRadius: 1,
            p: 1.5,
            mb: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: '#8b96a2', fontWeight: 700 }}>
            Status
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Chip
              label={isDemoMode ? 'Demo mode' : 'Live store'}
              size="small"
              onClick={isDemoMode ? handleExitDemo : undefined}
              sx={{
                bgcolor: isDemoMode ? 'rgba(47, 91, 234, 0.22)' : 'rgba(21, 184, 122, 0.18)',
                color: isDemoMode ? '#b9c8ff' : '#7df0bc',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            />
            <NotificationCenter onNotificationCountChange={(count) => setNotificationCount(count)} />
          </Box>
        </Box>

        {showAdmin && (
          <Box sx={{ display: 'grid', gap: 1, mb: 1 }}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={checkAuthStatus}>
              Refresh Session
            </Button>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={handleAdminLogout}>
              Logout Admin
            </Button>
          </Box>
        )}

        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            borderColor: 'rgba(255,255,255,0.16)',
            color: '#ffffff',
            '&:hover': {
              borderColor: 'rgba(255,255,255,0.45)',
              backgroundColor: 'rgba(255,255,255,0.10)',
            },
          }}
        >
          Logout
        </Button>
      </Box>
    );
  }

  return (
    <>
      <AppBar
        position="sticky"
        color="default"
        sx={{
          bgcolor: '#0b1016',
          color: '#ffffff',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <BrandMark dark />
          <Box sx={{ flexGrow: 1 }} />
          {isDemoMode && (
            <Chip
              label="Demo"
              size="small"
              onClick={handleExitDemo}
              sx={{
                bgcolor: 'rgba(47, 91, 234, 0.22)',
                color: '#b9c8ff',
                border: '1px solid rgba(255,255,255,0.12)',
                fontWeight: 800,
              }}
            />
          )}
          <NotificationCenter onNotificationCountChange={(count) => setNotificationCount(count)} />
          <IconButton color="inherit" onClick={toggleMobileMenu} sx={{ ml: 1 }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <MobileDrawer />
    </>
  );
};

export default NavBar;
