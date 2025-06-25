import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack, Dashboard, Business } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoDashboard = () => {
    navigate('/dashboard');
  };

  const handleGoCompetitors = () => {
    navigate('/competitors');
  };

  console.log('NotFoundPage: Rendering NotFound page');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        padding: 4,
      }}
    >
      <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 'bold', color: '#666', mb: 2 }}>
        404
      </Typography>
      <Typography variant="h4" sx={{ mb: 2, textAlign: 'center' }}>
        Page Not Found
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', maxWidth: 600, color: '#666' }}>
        The page you're looking for doesn't exist or has been moved. 
        {isAuthenticated ? ' Here are some options to get you back on track:' : ' Try going back to the homepage.'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={handleGoHome}
          sx={{ minWidth: 120 }}
        >
          Go Home
        </Button>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleGoBack}
          sx={{ minWidth: 120 }}
        >
          Go Back
        </Button>
      </Box>
      {isAuthenticated && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Dashboard />}
            onClick={handleGoDashboard}
            sx={{ minWidth: 140 }}
            color="primary"
          >
            Dashboard
          </Button>
          <Button
            variant="outlined"
            startIcon={<Business />}
            onClick={handleGoCompetitors}
            sx={{ minWidth: 140 }}
            color="primary"
          >
            Competitors
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default NotFoundPage; 