import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Home, Refresh, Build, Warning } from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';

// Animations for service unavailable theme
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

const serverPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
`;

const flicker = keyframes`
  0%, 100% { opacity: 1; }
  25% { opacity: 0.3; }
  50% { opacity: 1; }
  75% { opacity: 0.5; }
`;

const chartGrow = keyframes`
  0% { height: 0%; opacity: 0.3; }
  50% { height: 60%; opacity: 0.7; }
  100% { height: 20%; opacity: 0.3; }
`;

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// Styled components
const ServiceUnavailableContainer = styled(Box)(({ theme }) => ({
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
    background: `linear-gradient(45deg, ${theme.palette.error.main}15, ${theme.palette.error.light}10)`,
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
  color: theme.palette.error.main,
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

const StatusInfo = styled(Box)(({ theme }) => ({
  background: `${theme.palette.error.main}10`,
  border: `1px solid ${theme.palette.error.main}20`,
  borderRadius: '12px',
  padding: theme.spacing(3),
  margin: theme.spacing(4, 0),
  animation: `${slideUp} 0.8s ease-out 0.8s both`,
  textAlign: 'left',
}));

const StatusTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.1rem',
  fontWeight: 600,
  color: theme.palette.error.main,
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const StatusText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
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

const MaintenanceChart = styled(Box)({
  display: 'flex',
  alignItems: 'end',
  gap: '8px',
  height: '80px',
});

const ChartBar = styled(Box)<{ height: number; delay: number }>(({ height, delay, theme }) => ({
  width: '16px',
  background: `linear-gradient(to top, ${theme.palette.error.main}, ${theme.palette.error.light})`,
  borderRadius: '4px 4px 0 0',
  height: `${height}%`,
  opacity: 0,
  animation: `${chartGrow} 1.5s ease-out ${delay}s both infinite`,
}));

const ServerIcon = styled(Box)(({ theme }) => ({
  width: '80px',
  height: '80px',
  borderRadius: '12px',
  background: `linear-gradient(45deg, ${theme.palette.error.main}, ${theme.palette.error.light})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  animation: `${serverPulse} 2s ease-in-out infinite`,
  '&::before': {
    content: '"⚡"',
    fontSize: '2rem',
    color: 'white',
    animation: `${flicker} 1.5s ease-in-out infinite`,
  },
}));

const RefreshTimer = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  margin: theme.spacing(2, 0),
  padding: theme.spacing(1, 2),
  background: `${theme.palette.error.main}05`,
  borderRadius: '6px',
  color: theme.palette.error.main,
  fontWeight: 500,
  animation: `${slideUp} 0.8s ease-out 1.2s both`,
}));

const Spinner = styled(Box)(({ theme }) => ({
  width: '16px',
  height: '16px',
  border: `2px solid ${theme.palette.error.main}30`,
  borderTop: `2px solid ${theme.palette.error.main}`,
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  flexWrap: 'wrap',
  justifyContent: 'center',
  margin: theme.spacing(4, 0),
  animation: `${slideUp} 0.8s ease-out 1.4s both`,
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
}));

const StyledButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 500,
  borderRadius: '8px',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  [theme.breakpoints.down('sm')]: {
    width: '100%',
    maxWidth: '300px',
  },
}));

const FooterText = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(6),
  animation: `${slideUp} 0.8s ease-out 1.6s both`,
  color: theme.palette.text.disabled,
  fontSize: '0.9rem',
  lineHeight: 1.6,
}));

const ServiceUnavailablePage: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const maxChecks = 10; // Stop after 5 minutes

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const checkService = async () => {
      if (checkCount >= maxChecks) {
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      setCheckCount(prev => prev + 1);

      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache',
          credentials: 'include',
        });

        if (response.ok) {
          console.log('Service is back online');
          setIsChecking(false);
          // Service is back - navigate to home page
          navigate('/', { replace: true });
          return;
        }
      } catch (error) {
        console.log('Service still unavailable:', error);
      }

      setIsChecking(false);
    };

    // Start checking after 30 seconds
    interval = setInterval(checkService, 30000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [navigate, checkCount, maxChecks]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <ServiceUnavailableContainer>
      <BackgroundShapes>
        <div className="shape" />
        <div className="shape" />
        <div className="shape" />
      </BackgroundShapes>
      
      <ContentContainer>
        <ErrorCode>502</ErrorCode>
        
        <Title>Service Temporarily Unavailable</Title>
        
        <Description>
          Our analytics service is currently experiencing issues. We're working to restore service as quickly as possible.
        </Description>
        
        <StatusInfo>
          <StatusTitle>
            <Build />
            What's happening?
          </StatusTitle>
          <StatusText>
            Our backend services are temporarily down for maintenance or experiencing high load. 
            This typically resolves within a few minutes.
          </StatusText>
        </StatusInfo>
        
        <AnalyticsContainer>
          <ChartContainer>
            <MaintenanceChart>
              <ChartBar height={30} delay={0} />
              <ChartBar height={60} delay={0.2} />
              <ChartBar height={20} delay={0.4} />
              <ChartBar height={80} delay={0.6} />
              <ChartBar height={40} delay={0.8} />
              <ChartBar height={70} delay={1} />
            </MaintenanceChart>
            
            <ServerIcon />
          </ChartContainer>
        </AnalyticsContainer>
        
        {checkCount < maxChecks && (
          <RefreshTimer>
            <Spinner />
            <span>
              {isChecking ? 'Checking service status...' : 'Auto-checking service status...'}
            </span>
          </RefreshTimer>
        )}
        
        {checkCount >= maxChecks && (
          <RefreshTimer>
            <Warning />
            <span>Service check stopped. Please try manually.</span>
          </RefreshTimer>
        )}
        
        <ButtonContainer>
          <StyledButton
            variant="contained"
            color="error"
            startIcon={<Refresh />}
            onClick={handleRefresh}
          >
            Try Again
          </StyledButton>
          <StyledButton
            variant="outlined"
            color="error"
            startIcon={<Home />}
            onClick={handleGoHome}
          >
            Go Home
          </StyledButton>
        </ButtonContainer>
        
        <FooterText>
          If this issue persists, please contact our support team.<br />
          We apologize for the inconvenience and appreciate your patience.
        </FooterText>
      </ContentContainer>
    </ServiceUnavailableContainer>
  );
};

export default ServiceUnavailablePage; 