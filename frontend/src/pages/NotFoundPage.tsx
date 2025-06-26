import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowBack, Dashboard, Business } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { styled, keyframes } from '@mui/material/styles';

// Animations for intelligent analytics theme
const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
`;

const slideUp = keyframes`
  0% { transform: translateY(30px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

const chartGrow = keyframes`
  0% { height: 0%; }
  100% { height: var(--target-height); }
`;

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const sparkle = keyframes`
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
`;

const bounceData = keyframes`
  0%, 100% { 
    opacity: 0.5; 
    transform: translateY(0px) scale(0.9); 
  }
  50% { 
    opacity: 1; 
    transform: translateY(-10px) scale(1.1); 
  }
`;

// Styled components
const NotFoundContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, #ffffff 100%)`,
  padding: theme.spacing(4),
  position: 'relative',
  overflow: 'hidden',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const BackgroundShapes = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  zIndex: 0,
  '& .shape': {
    position: 'absolute',
    background: `linear-gradient(45deg, ${theme.palette.primary.main}15, ${theme.palette.primary.light}10)`,
    borderRadius: '50%',
    animation: `${float} 6s ease-in-out infinite`,
    '&:nth-of-type(1)': {
      width: '100px',
      height: '100px',
      top: '15%',
      left: '10%',
      animationDelay: '0s',
    },
    '&:nth-of-type(2)': {
      width: '150px',
      height: '150px',
      top: '70%',
      right: '15%',
      animationDelay: '2s',
    },
    '&:nth-of-type(3)': {
      width: '80px',
      height: '80px',
      bottom: '15%',
      left: '20%',
      animationDelay: '4s',
    },
  },
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  textAlign: 'center',
  maxWidth: '800px',
  width: '100%',
}));

const ErrorCode = styled(Typography)(({ theme }) => ({
  fontSize: '8rem',
  fontWeight: 700,
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(2),
  animation: `${slideUp} 0.8s ease-out 0.2s both, ${pulse} 3s ease-in-out infinite`,
  [theme.breakpoints.down('sm')]: {
    fontSize: '6rem',
  },
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: '2.5rem',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  animation: `${slideUp} 0.8s ease-out 0.4s both`,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '2rem',
  },
}));

const Description = styled(Typography)(({ theme }) => ({
  fontSize: '1.2rem',
  opacity: 0.8,
  animation: `${slideUp} 0.8s ease-out 0.6s both`,
  color: theme.palette.text.secondary,
  maxWidth: '600px',
  margin: '0 auto',
  marginBottom: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
  },
}));

const CountdownText = styled(Typography)(({ theme }) => ({
  fontSize: '1rem',
  marginBottom: theme.spacing(3),
  animation: `${slideUp} 0.8s ease-out 0.8s both`,
  color: theme.palette.primary.main,
  fontWeight: 500,
}));

const AnalyticsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(3),
  marginBottom: theme.spacing(4),
  animation: `${slideUp} 0.8s ease-out 1s both`,
}));

const ChartContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '3rem',
  marginBottom: '2rem',
  flexWrap: 'wrap',
});

const BarChart = styled(Box)({
  display: 'flex',
  alignItems: 'end',
  gap: '8px',
  height: '80px',
});

const ChartBar = styled(Box)<{ height: number; delay: number }>(({ height, delay, theme }) => ({
  width: '16px',
  background: `linear-gradient(to top, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
  borderRadius: '4px 4px 0 0',
  '--target-height': `${height}%`,
  animation: `${chartGrow} 1.5s ease-out ${delay}s both`,
}));

const PieChart = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  overflow: 'hidden',
  transform: 'rotate(-90deg)',
  '& .segment': {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    animation: `${rotate} 2s ease-in-out infinite`,
  },
  '& .segment-1': {
    background: `conic-gradient(${theme.palette.primary.main} 0deg 120deg, transparent 120deg)`,
    animationDelay: '0s',
  },
  '& .segment-2': {
    background: `conic-gradient(transparent 0deg 120deg, ${theme.palette.primary.light} 120deg 240deg, transparent 240deg)`,
    animationDelay: '0.7s',
  },
  '& .segment-3': {
    background: `conic-gradient(transparent 0deg 240deg, ${theme.palette.secondary.light} 240deg 360deg)`,
    animationDelay: '1.4s',
  },
}));

const DataPoints = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
  marginTop: theme.spacing(2),
  flexWrap: 'wrap',
}));

const DataPoint = styled(Box)<{ delay: number }>(({ delay }) => ({
  fontSize: '2rem',
  animation: `${bounceData} 1.5s ease-in-out ${delay}s infinite`,
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  animation: `${slideUp} 0.8s ease-out 1.2s both`,
}));

const Spinner = styled(Box)(({ theme }) => ({
  width: '32px',
  height: '32px',
  border: `3px solid ${theme.palette.primary.main}30`,
  borderTop: `3px solid ${theme.palette.primary.main}`,
  borderRadius: '50%',
  animation: `${rotate} 1s linear infinite`,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
}));

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, authLoading } = useAuth();
  const [countdown, setCountdown] = useState<number>(10);
  const [autoRedirectUrl, setAutoRedirectUrl] = useState<string>('');
  const [showAnalytics, setShowAnalytics] = useState(true);

  useEffect(() => {
    // Wait for auth loading to complete
    if (authLoading) return;

    // Determine redirect destination based on authentication
    const redirectUrl = isAuthenticated ? '/dashboard' : '/';
    setAutoRedirectUrl(redirectUrl);

    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Navigate directly without loading screen
          navigate(redirectUrl, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isAuthenticated, authLoading]);

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoDashboard = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleGoCompetitors = () => {
    navigate('/competitors', { replace: true });
  };

  const cancelAutoRedirect = () => {
    setCountdown(0);
    setAutoRedirectUrl('');
  };

  console.log('NotFoundPage: Rendering NotFound page');

  // Show loading while auth is being determined
  if (authLoading) {
    return (
      <NotFoundContainer>
        <Spinner />
        <Typography variant="h6" sx={{ color: 'text.secondary', mt: 2 }}>
          Loading...
        </Typography>
      </NotFoundContainer>
    );
  }

  return (
    <NotFoundContainer>
      <BackgroundShapes>
        <div className="shape" />
        <div className="shape" />
        <div className="shape" />
      </BackgroundShapes>

      <ContentContainer>
        <ErrorCode variant="h1">404</ErrorCode>
        
        <Title variant="h2">Page Not Found</Title>
        
        <Description variant="body1">
        The page you're looking for doesn't exist or has been moved. 
        {countdown > 0 && autoRedirectUrl && (
          <>
              {' '}We'll redirect you to the {isAuthenticated ? 'dashboard' : 'homepage'} automatically.
            </>
          )}
        </Description>

        {countdown > 0 && autoRedirectUrl && (
          <CountdownText variant="body1">
            Redirecting to {isAuthenticated ? 'dashboard' : 'homepage'} in {countdown} seconds...
          </CountdownText>
        )}

        {showAnalytics && (
          <AnalyticsContainer>
            <ChartContainer>
              <BarChart>
                <ChartBar height={60} delay={0.1} />
                <ChartBar height={80} delay={0.2} />
                <ChartBar height={45} delay={0.3} />
                <ChartBar height={90} delay={0.4} />
                <ChartBar height={70} delay={0.5} />
              </BarChart>
              <PieChart>
                <div className="segment segment-1" />
                <div className="segment segment-2" />
                <div className="segment segment-3" />
              </PieChart>
            </ChartContainer>
            <DataPoints>
              <DataPoint delay={0.2}>📊</DataPoint>
              <DataPoint delay={0.4}>📈</DataPoint>
              <DataPoint delay={0.6}>💡</DataPoint>
              <DataPoint delay={0.8}>🎯</DataPoint>
            </DataPoints>
          </AnalyticsContainer>
        )}

        <ButtonContainer>
        {countdown > 0 && autoRedirectUrl ? (
          <Button
            variant="outlined"
              onClick={cancelAutoRedirect}
              sx={{ minWidth: 180 }}
          >
            Cancel Auto-redirect
          </Button>
        ) : (
          <>
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
          </>
        )}
        </ButtonContainer>

      {isAuthenticated && !(countdown > 0 && autoRedirectUrl) && (
          <ButtonContainer>
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
            sx={{ mr: 1, mb: 1 }}
          >
            Market Intelligence
          </Button>
          </ButtonContainer>
      )}
      </ContentContainer>
    </NotFoundContainer>
  );
};

export default NotFoundPage; 