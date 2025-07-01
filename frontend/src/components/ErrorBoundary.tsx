import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Refresh, ArrowBack, BugReport, Dashboard, Analytics, Person } from '@mui/icons-material';
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

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
`;

const chartGrow = keyframes`
  0% { height: 0%; }
  100% { height: var(--target-height); }
`;

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
const ErrorContainer = styled(Box)(({ theme }) => ({
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

const ErrorIcon = styled(Box)(({ theme }) => ({
  fontSize: '6rem',
  marginBottom: theme.spacing(3),
  animation: `${slideUp} 0.8s ease-out 0.2s both, ${shake} 2s ease-in-out infinite`,
  color: theme.palette.error.main,
  [theme.breakpoints.down('sm')]: {
    fontSize: '4rem',
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
  background: `linear-gradient(to top, ${theme.palette.error.main}, ${theme.palette.error.light})`,
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
    background: `conic-gradient(from 0deg, ${theme.palette.error.main} 0deg, ${theme.palette.error.main} 120deg, transparent 120deg)`,
  },
  '& .segment-2': {
    background: `conic-gradient(from 120deg, ${theme.palette.error.light} 120deg, ${theme.palette.error.light} 240deg, transparent 240deg)`,
  },
  '& .segment-3': {
    background: `conic-gradient(from 240deg, ${theme.palette.warning.main} 240deg, ${theme.palette.warning.main} 360deg, transparent 360deg)`,
  },
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
  flexWrap: 'wrap',
  animation: `${slideUp} 0.8s ease-out 1.2s both`,
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'center',
  },
}));

const ErrorCode = styled(Typography)(({ theme }) => ({
  fontSize: '1rem',
  color: theme.palette.error.main,
  marginBottom: theme.spacing(2),
  animation: `${slideUp} 0.8s ease-out 0.8s both`,
  fontFamily: 'monospace',
  opacity: 0.7,
}));

interface State {
  hasError: boolean;
  error?: Error;
}

interface Props {
  children: ReactNode;
}

// Navigation component for buttons (no React Router hooks → works even without Router context)
const ErrorNavigation: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  // Check if user is likely authenticated by looking for shop cookie
  const isAuthenticated = document.cookie.includes('shop=');

  const handleGoHome = () => {
    window.location.href = '/?force=true';
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const handleGoDashboard = () => {
    window.location.href = '/dashboard';
  };

  const handleGoMarketIntelligence = () => {
    window.location.href = '/competitors';
  };

  const handleGoProfile = () => {
    window.location.href = '/profile';
  };

  return (
    <ButtonContainer>
      <Button
        variant="contained"
        color="primary"
        onClick={onRefresh}
        startIcon={<Refresh />}
        sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
      >
        Try Again
      </Button>
      {isAuthenticated && (
        <Button
          variant="contained"
          color="secondary"
          onClick={handleGoDashboard}
          startIcon={<Dashboard />}
          sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Go to Dashboard
        </Button>
      )}
      {isAuthenticated && (
        <Button
          variant="outlined"
          color="primary"
          onClick={handleGoMarketIntelligence}
          startIcon={<Analytics />}
          sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Market Intelligence
        </Button>
      )}
      {isAuthenticated && (
        <Button
          variant="outlined"
          color="primary"
          onClick={handleGoProfile}
          startIcon={<Person />}
          sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Profile
        </Button>
      )}
      {!isAuthenticated && (
        <Button
          variant="outlined"
          color="primary"
          onClick={handleGoHome}
          startIcon={<Home />}
          sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Go Home
        </Button>
      )}
      <Button
        variant="outlined"
        color="primary"
        onClick={handleGoBack}
        startIcon={<ArrowBack />}
        sx={{ minWidth: 120, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
      >
        Go Back
      </Button>
    </ButtonContainer>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error details to console
    console.error('🚨 ERROR BOUNDARY CAUGHT ERROR:', error);
    console.error('🚨 Error Stack:', error.stack);
    console.error('🚨 Component Stack:', errorInfo.componentStack);
    console.error('🚨 Error Info:', errorInfo);
    
    // Also log to localStorage for persistence
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    };
    
    try {
      localStorage.setItem('dashboard-error-log', JSON.stringify(errorLog));
    } catch (e) {
      console.error('Failed to save error to localStorage:', e);
    }
    
    this.setState({ hasError: true, error });
  }

  handleRefresh = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorContainer>
          <BackgroundShapes>
            <div className="shape" />
            <div className="shape" />
            <div className="shape" />
          </BackgroundShapes>
          
          <ContentContainer>
            <ErrorIcon>
              <BugReport />
            </ErrorIcon>
            
            <Title>
              Oops! Something went wrong
            </Title>
            
            <Description>
              We encountered an unexpected error while loading your dashboard. 
              Our team has been notified and we're working to fix this issue.
            </Description>

            <AnalyticsContainer>
              <ChartContainer>
                <BarChart>
                  <ChartBar height={60} delay={0.1} />
                  <ChartBar height={40} delay={0.2} />
                  <ChartBar height={80} delay={0.3} />
                  <ChartBar height={30} delay={0.4} />
                  <ChartBar height={70} delay={0.5} />
                  <ChartBar height={50} delay={0.6} />
                  <ChartBar height={90} delay={0.7} />
                </BarChart>
                
                <PieChart>
                  <div className="segment segment-1" />
                  <div className="segment segment-2" />
                  <div className="segment segment-3" />
                </PieChart>
              </ChartContainer>
            </AnalyticsContainer>

            {this.state.error && (
              <ErrorCode>
                Error: {this.state.error.message}
              </ErrorCode>
            )}

            <ErrorNavigation onRefresh={this.handleRefresh} />
          </ContentContainer>
        </ErrorContainer>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 