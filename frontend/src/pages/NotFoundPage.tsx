import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack, Search } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const NotFoundContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    animation: 'float 20s ease-in-out infinite',
  },
  '@keyframes float': {
    '0%, 100%': {
      transform: 'translateY(0px)',
    },
    '50%': {
      transform: 'translateY(-20px)',
    },
  },
}));

const ContentBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  color: 'white',
  zIndex: 1,
  position: 'relative',
  maxWidth: 600,
  padding: theme.spacing(4),
  animation: 'fadeInUp 1s ease-out',
  '@keyframes fadeInUp': {
    from: {
      opacity: 0,
      transform: 'translateY(30px)',
    },
    to: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

const ErrorNumber = styled(Typography)(({ theme }) => ({
  fontSize: '12rem',
  fontWeight: 900,
  lineHeight: 1,
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(45deg, #fff, #f0f0f0)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: '0 0 30px rgba(255,255,255,0.3)',
  animation: 'pulse 2s ease-in-out infinite',
  '@keyframes pulse': {
    '0%, 100%': {
      transform: 'scale(1)',
    },
    '50%': {
      transform: 'scale(1.05)',
    },
  },
  [theme.breakpoints.down('md')]: {
    fontSize: '8rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '6rem',
  },
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 700,
  marginBottom: theme.spacing(2),
  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  [theme.breakpoints.down('md')]: {
    fontSize: '2rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.5rem',
  },
}));

const Subtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  marginBottom: theme.spacing(4),
  opacity: 0.9,
  lineHeight: 1.6,
  [theme.breakpoints.down('md')]: {
    fontSize: '1.1rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
  },
}));

const ButtonGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
  flexWrap: 'wrap',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'center',
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 50,
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
  },
}));

const FloatingIcon = styled(Search)(({ theme }) => ({
  fontSize: '8rem',
  opacity: 0.1,
  position: 'absolute',
  top: '20%',
  right: '10%',
  animation: 'bounce 3s ease-in-out infinite',
  '@keyframes bounce': {
    '0%, 100%': {
      transform: 'translateY(0px) rotate(0deg)',
    },
    '50%': {
      transform: 'translateY(-30px) rotate(180deg)',
    },
  },
  [theme.breakpoints.down('md')]: {
    fontSize: '6rem',
    right: '5%',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '4rem',
    right: '2%',
  },
}));

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <NotFoundContainer>
      <FloatingIcon />
      <ContentBox>
        <ErrorNumber variant="h1">404</ErrorNumber>
        <Title variant="h2">Page Not Found</Title>
        <Subtitle variant="body1">
          Oops! It looks like you've wandered into uncharted territory. 
          The page you're looking for might have moved, been deleted, or never existed.
        </Subtitle>
        <ButtonGroup>
          <StyledButton
            variant="contained"
            startIcon={<Home />}
            onClick={handleGoHome}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.3)',
              },
            }}
          >
            Go Home
          </StyledButton>
          <StyledButton
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={handleGoBack}
            sx={{
              color: 'white',
              borderColor: 'rgba(255,255,255,0.5)',
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            Go Back
          </StyledButton>
        </ButtonGroup>
      </ContentBox>
    </NotFoundContainer>
  );
};

export default NotFoundPage; 