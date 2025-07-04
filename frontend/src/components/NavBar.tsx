import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Badge, 
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Insights as InsightsIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { getSuggestionCount } from '../api';
import { NotificationCenter } from './ui/NotificationCenter';

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
    logout();
    setMobileMenuOpen(false);
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
      badge: suggestionCount
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
          <InsightsIcon sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            ShopGauge
        </Typography>
        </Box>
          
          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop Navigation */}
          {!isMobile && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {isAuthenticated ? (
            <>
              <Button
                color="inherit"
                onClick={() => navigate('/?force=true')}
                sx={{
                  backgroundColor: location.pathname === '/' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)'
                  }
                }}
              >
                Home
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/dashboard')}
                sx={{
                  backgroundColor: location.pathname === '/dashboard' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)'
                  }
                }}
              >
                Dashboard
              </Button>
              <Badge 
                badgeContent={suggestionCount} 
                color="error"
                invisible={suggestionCount === 0}
              >
              <Button
                color="inherit"
                  onClick={() => navigate('/competitors')}
                sx={{
                    backgroundColor: location.pathname === '/competitors' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.12)'
                    }
                }}
              >
                  Market Intelligence
              </Button>
              </Badge>
              <Button
                color="inherit"
                onClick={() => navigate('/profile')}
                sx={{
                  backgroundColor: location.pathname === '/profile' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)'
                  }
                }}
              >
                Profile
              </Button>
                
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