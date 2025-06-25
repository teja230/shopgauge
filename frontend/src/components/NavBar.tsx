import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppBar, Toolbar, Typography, Box, Button, Badge } from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import { getSuggestionCount } from '../api';
import { NotificationCenter } from './ui/NotificationCenter';

const NavBar: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  // You can choose between 'top-right' or 'top-center' positioning
  const notificationPosition = 'top-center'; // Change this to 'top-right' if preferred
  const isTopCenter = notificationPosition === 'top-center';

  const handleLogout = () => {
    logout();
  };

  // Fetch suggestion count when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fetchSuggestionCount = async () => {
        try {
          const response = await getSuggestionCount();
          setSuggestionCount(response.newSuggestions);
        } catch (error) {
          console.error('Error fetching suggestion count:', error);
          setSuggestionCount(0);
        }
      };

      fetchSuggestionCount();
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchSuggestionCount, 30000);
      return () => clearInterval(interval);
    } else {
      setSuggestionCount(0);
    }
  }, [isAuthenticated]);

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
          <Box sx={{ display: 'flex', gap: 2, flexGrow: 1 }} />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                <Button
                  color="inherit"
                  onClick={() => navigate('/dashboard')}
                  sx={{
                    backgroundColor: location.pathname === '/dashboard' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
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
                      backgroundColor: location.pathname === '/competitors' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                    }}
                  >
                    Competitors
                  </Button>
                </Badge>
                <Button
                  color="inherit"
                  onClick={() => navigate('/profile')}
                  sx={{
                    backgroundColor: location.pathname === '/profile' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                  }}
                >
                  Profile
                </Button>
                
                {/* Notification Center - conditional positioning */}
                {!isTopCenter && (
                  <Box sx={{ ml: 1 }}>
                    <NotificationCenter 
                      position="top-right"
                      onNotificationCountChange={(count) => setNotificationCount(count)}
                    />
                  </Box>
                )}
                
                <Button color="inherit" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button color="inherit" onClick={() => navigate('/')}>
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Top-center notification positioning */}
      {isAuthenticated && isTopCenter && (
        <NotificationCenter 
          position="top-center"
          onNotificationCountChange={(count) => setNotificationCount(count)}
        />
      )}
    </>
  );
};

export default NavBar; 