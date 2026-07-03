import React, { useState, useEffect, useRef } from 'react';
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
  Chip,
  Divider,
  Tooltip,
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
  Search as SearchIcon,
  Storefront as StorefrontIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './ui/NotificationCenter';
import { adminLogout, getAdminStatus } from '../api/admin';
import { getSuggestionCount } from '../api';
import { isAppShellPath } from '../utils/routeChrome';

const NavBar: React.FC = () => {
  const { isAuthenticated, logout, isDemoMode, shop } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const suggestionCountRef = useRef(0);
  const lastFetchTimeRef = useRef(0);
  const storeDomain = shop || (isDemoMode ? 'demo-shopgauge.myshopify.com' : 'Connected store');
  const storeInitial = storeDomain.replace(/^https?:\/\//, '').charAt(0).toUpperCase() || 'S';

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

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('shopgauge:open-command-palette'));
  };

  // Fetch suggestion count ONLY on initial load - NO POLLING (on-demand only)
  useEffect(() => {
    if (isAuthenticated) {
      const fetchSuggestionCount = async () => {
        try {
          // Only fetch if cache is expired (24 hours) or no data
          const now = Date.now();
          const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for costly APIs

          if (now - lastFetchTimeRef.current < CACHE_DURATION && suggestionCountRef.current > 0) {
            return; // Use cached value
          }

          const response = await getSuggestionCount();
          setSuggestionCount(response.newSuggestions);
          suggestionCountRef.current = response.newSuggestions;
          lastFetchTimeRef.current = now;
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
      suggestionCountRef.current = 0;
      lastFetchTimeRef.current = 0;
    }
  }, [isAuthenticated]); // Removed polling dependencies

  const showAdmin = location.pathname.startsWith('/admin');
  const shellHasDemoMode =
    isDemoMode ||
    localStorage.getItem('demo_mode_active') === 'true' ||
    new URLSearchParams(location.search).get('demo') === 'true';
  const appShellActive =
    isAppShellPath(location.pathname) &&
    (isAuthenticated || shellHasDemoMode);

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
        '& .MuiBackdrop-root': {
          backdropFilter: 'blur(10px)',
          backgroundColor: 'rgba(16,24,32,0.38)',
        },
        '& .MuiDrawer-paper': {
          width: 280,
          backgroundColor: '#101820',
          color: '#ffffff',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(47,91,234,0.20), transparent 28%), linear-gradient(180deg, #101820 0%, #0b1016 100%)',
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

      <Box sx={{ px: 2, py: 1.5 }}>
        <SearchAffordance compact />
      </Box>

      <List sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5, px: 1 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path.split('?')[0];
          return (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={isActive}
              sx={{
                position: 'relative',
                borderRadius: 1,
                minHeight: 48,
                color: isActive ? '#ffffff' : '#bdc8d2',
                overflow: 'hidden',
                transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.2s ease',
                '& .MuiListItemIcon-root': {
                  color: 'inherit',
                  minWidth: 40,
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  borderRadius: '0 3px 3px 0',
                  backgroundColor: '#7c9cff',
                  transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(47, 91, 234, 0.18)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  '&:hover': {
                    backgroundColor: 'rgba(47, 91, 234, 0.24)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 850 : 750 }} />
              {item.badge > 0 && (
                <Box
                  sx={{
                    minWidth: 24,
                    height: 22,
                    px: 0.75,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 999,
                    bgcolor: 'rgba(47,91,234,0.24)',
                    color: '#c8d4ff',
                    border: '1px solid rgba(124,156,255,0.26)',
                    fontSize: 11,
                    fontWeight: 900,
                    fontFeatureSettings: '"tnum"',
                  }}
                >
                  {item.badge}
                </Box>
              )}
            </ListItemButton>
          </ListItem>
          );
        })}
      </List>

      {appShellActive && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
          <Box sx={{ p: 2, display: 'grid', gap: 1.25 }}>
            <StoreCard mobile />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box
                sx={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 44,
                  bgcolor: 'rgba(255,255,255,0.045)',
                }}
              >
                <NotificationCenter onNotificationCountChange={(count) => setNotificationCount(count)} />
              </Box>
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  minHeight: 44,
                  borderColor: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  px: 1,
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.45)',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                  },
                }}
              >
                Logout
              </Button>
            </Box>
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

  const SearchAffordance = ({ compact = false }: { compact?: boolean }) => (
    <Box
      component="button"
      type="button"
      onClick={openCommandPalette}
      sx={{
        width: '100%',
        minHeight: compact ? 42 : 44,
        px: compact ? 1.25 : 1.5,
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.045)',
        color: '#aebbc6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(47, 91, 234, 0.14)',
          borderColor: 'rgba(47, 91, 234, 0.38)',
          transform: 'translateY(-1px)',
        },
        '&:focus-visible': {
          outline: '2px solid rgba(124, 156, 255, 0.9)',
          outlineOffset: 2,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <SearchIcon sx={{ fontSize: 18, color: '#7c9cff' }} />
        <Typography variant="body2" sx={{ color: '#d6dde5', fontWeight: 750 }}>
          Search
        </Typography>
      </Box>
      <Box
        sx={{
          px: 0.85,
          py: 0.25,
          borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#8fa4ff',
          fontSize: 11,
          fontWeight: 850,
          lineHeight: 1.4,
        }}
      >
        ⌘K
      </Box>
    </Box>
  );

  const StoreCard = ({ mobile = false }: { mobile?: boolean }) => (
    <Box
      sx={{
        border: '1px solid rgba(255,255,255,0.10)',
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.035) 100%)',
        borderRadius: 1,
        p: mobile ? 1.25 : 1.5,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 42px -32px rgba(0,0,0,0.8)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: '#ffffff',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #2f5bea 0%, #1539a6 100%)',
            boxShadow: '0 14px 30px -18px rgba(47,91,234,0.95)',
          }}
        >
          {storeInitial}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: '#ffffff',
              fontWeight: 850,
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {storeDomain}
          </Typography>
          <Box sx={{ mt: 0.55, display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isDemoMode ? '#7c9cff' : '#15b87a',
                boxShadow: isDemoMode
                  ? '0 0 0 5px rgba(47,91,234,0.18), 0 0 18px rgba(124,156,255,0.58)'
                  : '0 0 0 5px rgba(21,184,122,0.16), 0 0 18px rgba(21,184,122,0.52)',
              }}
            />
            <Typography variant="caption" sx={{ color: '#aab7c2', fontWeight: 800 }}>
              {isDemoMode ? 'Demo mode' : 'Live store'}
            </Typography>
            {isDemoMode && (
              <Button
                size="small"
                startIcon={<LogoutIcon sx={{ fontSize: 13 }} />}
                onClick={handleExitDemo}
                sx={{
                  ml: 0.5,
                  minWidth: 0,
                  minHeight: 22,
                  height: 22,
                  px: 0.85,
                  borderRadius: 999,
                  color: '#dbe5ff',
                  bgcolor: 'rgba(47,91,234,0.16)',
                  border: '1px solid rgba(124,156,255,0.26)',
                  fontSize: 11,
                  fontWeight: 850,
                  lineHeight: 1,
                  textTransform: 'none',
                  '& .MuiButton-startIcon': { mr: 0.35, ml: 0 },
                  '&:hover': {
                    bgcolor: 'rgba(47,91,234,0.25)',
                    borderColor: 'rgba(124,156,255,0.46)',
                  },
                }}
              >
                Leave
              </Button>
            )}
          </Box>
        </Box>
        <StorefrontIcon sx={{ color: 'rgba(185,200,255,0.72)', fontSize: 18, flexShrink: 0 }} />
      </Box>
    </Box>
  );

  if (!appShellActive) {
    return (
      <AppBar
        position="sticky"
        color="transparent"
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.78)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'rgba(16, 24, 32, 0.10)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 18px 42px -36px rgb(16 24 32 / 0.75)',
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
          backgroundImage:
            'radial-gradient(circle at 18% 0%, rgba(47,91,234,0.24), transparent 24%), linear-gradient(180deg, #101820 0%, #0b1016 100%)',
          boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.04)',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
        }}
      >
        <Box sx={{ p: 1, pb: 2 }}>
          <BrandMark dark />
        </Box>

        <Box sx={{ px: 1, pb: 2.5 }}>
          <SearchAffordance />
        </Box>

        <Box sx={{ px: 1, pb: 2 }}>
          <Typography
            variant="caption"
            sx={{ color: '#7f9188', fontWeight: 850, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
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
                    position: 'relative',
                    borderRadius: 1,
                    minHeight: 46,
                    color: isActive ? '#ffffff' : '#b9c7c0',
                    overflow: 'hidden',
                    transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.2s ease',
                    '& .MuiListItemIcon-root': {
                      color: isActive ? '#8fa4ff' : 'inherit',
                      minWidth: 38,
                      transition: 'color 0.2s ease',
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 9,
                      bottom: 9,
                      width: 3,
                      borderRadius: '0 3px 3px 0',
                      backgroundColor: '#7c9cff',
                      boxShadow: '0 0 18px rgba(124,156,255,0.58)',
                      transform: isActive ? 'scaleY(1)' : 'scaleY(0)',
                      transformOrigin: 'center',
                      transition: 'transform 0.2s ease',
                    },
                    '&.Mui-selected': {
                      bgcolor: 'rgba(47, 91, 234, 0.18)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      '&:hover': { bgcolor: 'rgba(47, 91, 234, 0.24)' },
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      transform: 'translateY(-1px)',
                      '& .MuiListItemIcon-root': {
                        color: '#8fa4ff',
                      },
                    },
                  }}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 800 : 700 }}
                  />
                  {item.badge > 0 && (
                    <Box
                      sx={{
                        minWidth: 24,
                        height: 22,
                        px: 0.75,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 999,
                        bgcolor: 'rgba(47,91,234,0.24)',
                        color: '#c8d4ff',
                        border: '1px solid rgba(124,156,255,0.26)',
                        fontSize: 11,
                        fontWeight: 900,
                        fontFeatureSettings: '"tnum"',
                      }}
                    >
                      {item.badge}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ display: 'grid', gap: 1.25, mb: 1.5 }}>
          <StoreCard />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Tooltip title="Notifications">
              <Box
                sx={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 1,
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 46,
                  bgcolor: 'rgba(255,255,255,0.045)',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                  '&:hover': {
                    bgcolor: 'rgba(47,91,234,0.14)',
                    borderColor: 'rgba(47,91,234,0.36)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <NotificationCenter onNotificationCountChange={(count) => setNotificationCount(count)} />
              </Box>
            </Tooltip>
            <Tooltip title="Logout">
              <Button
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{
                  minHeight: 46,
                  borderColor: 'rgba(255,255,255,0.16)',
                  color: '#ffffff',
                  px: 1,
                  '& .MuiButton-startIcon': { mr: 0.5 },
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.45)',
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Logout
              </Button>
            </Tooltip>
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
