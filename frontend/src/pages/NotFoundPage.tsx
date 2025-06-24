import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack } from '@mui/icons-material';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
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
      <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', maxWidth: 600 }}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
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
      <Box sx={{ mt: 4, p: 2, backgroundColor: '#fff', borderRadius: 1, maxWidth: 600 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Debug Info:</Typography>
        <Typography variant="body2">Current URL: {window.location.href}</Typography>
        <Typography variant="body2">Current Path: {window.location.pathname}</Typography>
        <Typography variant="body2">Current Search: {window.location.search}</Typography>
        <Typography variant="body2">User Agent: {navigator.userAgent}</Typography>
      </Box>
    </Box>
  );
};

export default NotFoundPage; 