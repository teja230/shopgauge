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

const dataFlow = keyframes`
  0% { transform: translateX(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
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

// Styled components
const LoadingContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
}));

const BackgroundShapes = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  zIndex: 0,
  '& .shape': {
    position: 'absolute',
    background: 'rgba(255, 255, 255, 0.1)',
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
});

const ContentContainer = styled(Box)({
  position: 'relative',
  zIndex: 1,
  textAlign: 'center',
  maxWidth: '600px',
  padding: '2rem',
});

const Logo = styled(Typography)({
  fontSize: '3rem',
  fontWeight: 700,
  marginBottom: '2rem',
  animation: `${slideUp} 0.8s ease-out 0.2s both`,
  background: 'linear-gradient(45deg, #ffffff, #e0e7ff)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

const LoadingIcon = styled(Box)({
  fontSize: '4rem',
  marginBottom: '2rem',
  animation: `${slideUp} 0.8s ease-out 0.4s both, ${pulse} 2s ease-in-out infinite`,
});

const Title = styled(Typography)({
  fontSize: '2rem',
  fontWeight: 600,
  marginBottom: '1rem',
  animation: `${slideUp} 0.8s ease-out 0.6s both`,
});

const Description = styled(Typography)({
  fontSize: '1.1rem',
  marginBottom: '3rem',
  opacity: 0.9,
  animation: `${slideUp} 0.8s ease-out 0.8s both`,
});

const AnalyticsContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2rem',
  animation: `${slideUp} 0.8s ease-out 1s both`,
});

const ChartContainer = styled(Box)({
  display: 'flex',
  alignItems: 'end',
  gap: '8px',
  height: '80px',
  marginBottom: '1rem',
});

const ChartBar = styled(Box)<{ height: number; delay: number }>(({ height, delay }) => ({
  width: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  borderRadius: '6px 6px 0 0',
  '--target-height': `${height}%`,
  animation: `${chartGrow} 1s ease-out ${delay}s both`,
}));

const DataPoints = styled(Box)({
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  flexWrap: 'wrap',
});

const DataPoint = styled(Box)<{ delay: number }>(({ delay }) => ({
  fontSize: '1.5rem',
  padding: '0.5rem',
  borderRadius: '50%',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  animation: `${sparkle} 2s ease-in-out ${delay}s infinite`,
}));

const ProgressContainer = styled(Box)({
  width: '100%',
  maxWidth: '300px',
  marginTop: '2rem',
});

const LoadingText = styled(Typography)({
  fontSize: '0.9rem',
  opacity: 0.8,
  marginBottom: '0.5rem',
  animation: `${dataFlow} 3s ease-in-out infinite`,
});

const SpinnerContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  marginTop: '1rem',
});

const Spinner = styled(Box)({
  width: '24px',
  height: '24px',
  border: '3px solid rgba(255, 255, 255, 0.3)',
  borderTop: '3px solid white',
  borderRadius: '50%',
  animation: `${rotate} 1s linear infinite`,
});

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
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: 'linear-gradient(90deg, #ffffff, #e0e7ff)',
              },
            }}
          />
          <SpinnerContainer>
            <Spinner />
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {Math.round(currentProgress)}%
            </Typography>
          </SpinnerContainer>
        </ProgressContainer>
      </ContentContainer>
    </LoadingContainer>
  );
};

export default IntelligentLoadingScreen; 