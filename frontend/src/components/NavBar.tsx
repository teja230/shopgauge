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
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const handleLogout = () => {
    // Handle regular logout
    logout();
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

  const menuItems = isAuthenticated ? [
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
      badge: 0
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
          backgroundColor: theme.palette.background.default,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          backgroundColor: theme.palette.primary.main,
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <InsightsIcon sx={{ mr: 1 }} />
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
                '&.Mui-selected': {
                  backgroundColor: `${theme.palette.primary.main}15`,
                  '&:hover': {
                    backgroundColor: `${theme.palette.primary.main}25`,
                  },
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

      {isAuthenticated && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                '&:hover': {
                  borderColor: theme.palette.error.dark,
                  backgroundColor: `${theme.palette.error.main}10`,
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

  return (
    <>
    <AppBar position="static">
      <Toolbar>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            mr: 2,
            userSelect: 'none',
          }}
          onClick={() => {
            // Smart navigation: go to dashboard if authenticated, home if not
            if (isAuthenticated) {
              navigate('/dashboard');
            } else {
              navigate('/');
            }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              mr: 1.5,
            }}
          >
            <InsightsIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            ShopGauge
        </Typography>
        </Box>
          
          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop Navigation */}
          {!isMobile && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path.split('?')[0];
                return (
                  <Button
                    key={item.text}
                    color="inherit"
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: '8px',
                      px: 2,
                      fontWeight: isActive ? 700 : 600,
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.12)'
                      }
                    }}
                  >
                    {item.text}
                  </Button>
                );
              })}

              {/* Admin-specific buttons */}
              {showAdmin && (
                <>
                  <Button
                    color="inherit"
                    onClick={checkAuthStatus}
                    startIcon={<RefreshIcon />}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.12)'
                      }
                    }}
                  >
                    Refresh Session
                  </Button>
                  <Button
                    color="inherit"
                    onClick={handleAdminLogout}
                    startIcon={<LogoutIcon />}
                    sx={{
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.12)'
                      }
                    }}
                  >
                    Logout Admin
                  </Button>
                </>
              )}
              
              {/* Notification Center positioned near Profile */}
              <Box sx={{ ml: 1 }}>
                <NotificationCenter 
                  onNotificationCountChange={(count) => setNotificationCount(count)}
                />
              </Box>
                
              <Button color="inherit" onClick={handleLogout}>
                Logout
              </Button>
            </>
              ) : null}
            </Box>
          )}

                    {/* Mobile Menu Button - Only show when authenticated */}
          {isMobile && isAuthenticated && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationCenter 
                onNotificationCountChange={(count) => setNotificationCount(count)}
              />
              <IconButton
                color="inherit"
                onClick={toggleMobileMenu}
                sx={{ ml: 1 }}
              >
                <MenuIcon />
              </IconButton>
        </Box>
          )}
      </Toolbar>
    </AppBar>

      {/* Mobile Drawer - Only render when authenticated */}
      {isMobile && isAuthenticated && <MobileDrawer />}
    </>
  );
};

export default NavBar; 