import React, { useState, useEffect } from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

// Animations
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

// Styled components - Updated to match site theme with intuitive gradient
const LoadingContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: theme.palette.background.default,
  // More intuitive gradient: light gray to white, matching site theme
  background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, #ffffff 100%)`,
  color: theme.palette.text.primary,
  position: 'relative',
  overflow: 'hidden',
  fontFamily: theme.typography.fontFamily,
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
    background: `linear-gradient(45deg, ${theme.palette.primary.main}20, ${theme.palette.primary.light}15)`,
    borderRadius: '50%',
    animation: `${float} 6s ease-in-out infinite`,
    '&:nth-of-type(1)': {
      width: '80px',
      height: '80px',
      top: '20%',
      left: '10%',
      animationDelay: '0s',
    },
    '&:nth-of-type(2)': {
      width: '120px',
      height: '120px',
      top: '60%',
      right: '10%',
      animationDelay: '2s',
    },
    '&:nth-of-type(3)': {
      width: '60px',
      height: '60px',
      bottom: '20%',
      left: '20%',
      animationDelay: '4s',
    },
  },
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  textAlign: 'center',
  maxWidth: '600px',
  padding: theme.spacing(4),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

const Logo = styled(Typography)(({ theme }) => ({
  fontSize: '3rem',
  fontWeight: 700,
  marginBottom: theme.spacing(3),
  animation: `${slideUp} 0.8s ease-out 0.2s both`,
  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  [theme.breakpoints.down('sm')]: {
    fontSize: '2.5rem',
  },
}));

const LoadingIcon = styled(Box)(({ theme }) => ({
  fontSize: '4rem',
  marginBottom: theme.spacing(3),
  animation: `${slideUp} 0.8s ease-out 0.4s both, ${pulse} 2s ease-in-out infinite`,
  color: theme.palette.primary.main,
  [theme.breakpoints.down('sm')]: {
    fontSize: '3rem',
  },
}));

const Title = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  animation: `${slideUp} 0.8s ease-out 0.6s both`,
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1.5rem',
  },
}));

const Description = styled(Typography)(({ theme }) => ({
  fontSize: '1.1rem',
  marginBottom: theme.spacing(4),
  opacity: 0.8,
  animation: `${slideUp} 0.8s ease-out 0.8s both`,
  color: theme.palette.text.secondary,
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
  },
}));

const AnalyticsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(3),
  animation: `${slideUp} 0.8s ease-out 1s both`,
}));

const ChartContainer = styled(Box)({
  display: 'flex',
  alignItems: 'end',
  gap: '8px',
  height: '80px',
  marginBottom: '1rem',
});

const ChartBar = styled(Box)<{ height: number; delay: number }>(({ height, delay, theme }) => ({
  width: '12px',
  background: `linear-gradient(to top, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
  borderRadius: theme.shape.borderRadius,
  '--target-height': `${height}%`,
  animation: `${chartGrow} 1s ease-out ${delay}s both`,
}));

const DataPoints = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
  flexWrap: 'wrap',
}));

const DataPoint = styled(Box)<{ delay: number }>(({ delay, theme }) => ({
  fontSize: '1.5rem',
  padding: theme.spacing(1),
  borderRadius: '50%',
  backgroundColor: `${theme.palette.primary.main}15`,
  animation: `${sparkle} 2s ease-in-out ${delay}s infinite`,
  border: `1px solid ${theme.palette.primary.main}30`,
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: '400px',
  marginTop: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}));

const LoadingText = styled(Typography)(({ theme }) => ({
  fontSize: '0.9rem',
  opacity: 0.9,
  marginBottom: theme.spacing(2),
  fontWeight: 500,
  color: theme.palette.text.secondary,
  textAlign: 'center',
}));

const SpinnerContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const Spinner = styled(Box)(({ theme }) => ({
  width: '24px',
  height: '24px',
  border: `3px solid ${theme.palette.primary.main}30`,
  borderTop: `3px solid ${theme.palette.primary.main}`,
  borderRadius: '50%',
  animation: `${rotate} 1s linear infinite`,
}));

interface IntelligentLoadingScreenProps {
  message?: string;
  progress?: number;
}

const IntelligentLoadingScreen: React.FC<IntelligentLoadingScreenProps> = ({ 
  message = "Setting up your analytics dashboard...",
  progress 
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);
  const [currentProgress, setCurrentProgress] = useState(progress || 0);

  const loadingMessages = [
    "Initializing ShopGauge...",
    "Connecting to your store...",
    "Loading analytics engine...",
    "Preparing your dashboard...",
    "Almost ready!"
  ];

  useEffect(() => {
    if (progress === undefined) {
      let messageIndex = 0;
      let progressValue = 0;

      const interval = setInterval(() => {
        progressValue += Math.random() * 20 + 10;
        if (progressValue >= 100) {
          progressValue = 100;
          clearInterval(interval);
        }

        setCurrentProgress(progressValue);

        if (progressValue > messageIndex * 20 && messageIndex < loadingMessages.length - 1) {
          messageIndex++;
          setCurrentMessage(loadingMessages[messageIndex]);
        }
      }, 800);

      return () => clearInterval(interval);
    } else {
      setCurrentProgress(progress);
      setCurrentMessage(message);
    }
  }, [message, progress]);

  return (
    <LoadingContainer>
      <BackgroundShapes>
        <div className="shape" />
        <div className="shape" />
        <div className="shape" />
      </BackgroundShapes>

      <ContentContainer>
        <Logo variant="h1">ShopGauge</Logo>
        
        <LoadingIcon>⚡</LoadingIcon>
        
        <Title variant="h2">Intelligent Analytics Loading</Title>
        
        <Description variant="body1">
          Preparing your personalized analytics dashboard with AI-powered insights
        </Description>
        
        <AnalyticsContainer>
          <ChartContainer>
            <ChartBar height={60} delay={0.2} />
            <ChartBar height={80} delay={0.4} />
            <ChartBar height={45} delay={0.6} />
            <ChartBar height={90} delay={0.8} />
            <ChartBar height={70} delay={1.0} />
            <ChartBar height={55} delay={1.2} />
            <ChartBar height={85} delay={1.4} />
          </ChartContainer>
          
          <DataPoints>
            <DataPoint delay={0.2}>📊</DataPoint>
            <DataPoint delay={0.4}>📈</DataPoint>
            <DataPoint delay={0.6}>💡</DataPoint>
            <DataPoint delay={0.8}>🎯</DataPoint>
            <DataPoint delay={1.0}>⚡</DataPoint>
            <DataPoint delay={1.2}>🔍</DataPoint>
          </DataPoints>
        </AnalyticsContainer>

        <ProgressContainer>
          <LoadingText variant="body2">
            {currentMessage}
          </LoadingText>
          <LinearProgress 
            variant="determinate" 
            value={currentProgress}
            sx={{
              width: '100%',
              height: 8,
              borderRadius: 4,
              backgroundColor: (theme) => `${theme.palette.primary.main}20`,
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              },
            }}
          />
          <SpinnerContainer>
            <Spinner />
            <Typography 
              variant="body2" 
              sx={{ 
                opacity: 0.9, 
                fontWeight: 500,
                color: (theme) => theme.palette.primary.main,
              }}
            >
              {Math.round(currentProgress)}%
            </Typography>
          </SpinnerContainer>
        </ProgressContainer>
      </ContentContainer>
    </LoadingContainer>
  );
};

export default IntelligentLoadingScreen; 