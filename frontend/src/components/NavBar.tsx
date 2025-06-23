import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';

const NavBar: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          StoreSight
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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
              <Button
                color="inherit"
                onClick={() => navigate('/competitors')}
                sx={{
                  backgroundColor: location.pathname === '/competitors' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                }}
              >
                Competitors
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/admin')}
                sx={{
                  backgroundColor: location.pathname === '/admin' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                }}
              >
                Admin
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/profile')}
                sx={{
                  backgroundColor: location.pathname === '/profile' ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                }}
              >
                Profile
              </Button>
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
  );
};

export default NavBar; 