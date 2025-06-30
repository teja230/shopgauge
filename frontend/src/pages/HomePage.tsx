import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import { 
  Button, 
  TextField, 
  Typography, 
  Box, 
  Container, 
  Alert,
  Card,
  CardContent,
  Chip,
  Avatar,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Fade,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Business as BusinessIcon,
  CloudSync as CloudSyncIcon,
  Speed as SpeedIcon,
  AdminPanelSettings as AdminIcon,
  Storefront as StorefrontIcon,
  Shield as ShieldIcon,
  Timeline as TimelineIcon,
  Devices as DevicesIcon,
  AutoGraph as AutoGraphIcon,
  Bolt as BoltIcon,
  VerifiedUser as VerifiedUserIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Enhanced styled components for mobile-first enterprise design
const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: 'white',
  padding: theme.spacing(8, 0),
  textAlign: 'center',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.1)',
    zIndex: 1,
  },
  '& > *': {
    position: 'relative',
    zIndex: 2,
  },
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(6, 0),
    minHeight: '50vh',
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(4, 0),
    minHeight: '40vh',
  },
}));

const HeroContent = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(2),
  },
}));

const HeroTitle = styled(Typography)(({ theme }) => ({
  fontSize: '3.5rem',
  fontWeight: 800,
  lineHeight: 1.1,
  marginBottom: theme.spacing(2),
  background: 'linear-gradient(45deg, #ffffff, #f0f9ff)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  [theme.breakpoints.down('lg')]: {
    fontSize: '3rem',
  },
  [theme.breakpoints.down('md')]: {
    fontSize: '2.5rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '2rem',
    lineHeight: 1.2,
  },
  [theme.breakpoints.down('xs')]: {
    fontSize: '1.75rem',
  },
}));

const HeroSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.25rem',
  fontWeight: 400,
  opacity: 0.9,
  maxWidth: 600,
  lineHeight: 1.6,
  [theme.breakpoints.down('md')]: {
    fontSize: '1.125rem',
  },
  [theme.breakpoints.down('sm')]: {
    fontSize: '1rem',
    maxWidth: '100%',
  },
}));

const FeatureGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: theme.spacing(3),
  marginTop: theme.spacing(6),
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(2.5),
    marginTop: theme.spacing(4),
  },
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'default',
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: theme.palette.primary.light,
  },
  // Disable hover effects on mobile
  '@media (hover: none)': {
    '&:hover': {
      transform: 'none',
      boxShadow: theme.shadows[2],
    },
  },
}));

const FeatureIcon = styled(Avatar)(({ theme }) => ({
  width: 56,
  height: 56,
  marginBottom: theme.spacing(2),
  backgroundColor: 'transparent',
  border: `2px solid ${theme.palette.primary.main}`,
  color: theme.palette.primary.main,
  '& .MuiSvgIcon-root': {
    fontSize: '1.75rem',
  },
  [theme.breakpoints.down('sm')]: {
    width: 48,
    height: 48,
    '& .MuiSvgIcon-root': {
      fontSize: '1.5rem',
    },
  },
}));

const ConnectSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(8, 0),
  backgroundColor: theme.palette.background.default,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(4, 0),
  },
}));

const ConnectCard = styled(Card)(({ theme }) => ({
  maxWidth: 500,
  margin: '0 auto',
  borderRadius: 24,
  boxShadow: theme.shadows[8],
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

const ConnectForm = styled('form')(({ theme }) => ({
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    gap: theme.spacing(2.5),
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.3s ease',
    // Prevent iOS zoom on focus
    fontSize: '16px',
    [theme.breakpoints.up('sm')]: {
      fontSize: '14px',
    },
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.light,
      },
    },
    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderWidth: '2px',
        borderColor: theme.palette.primary.main,
      },
    },
  },
  '& .MuiFormLabel-root': {
    fontSize: '16px',
    [theme.breakpoints.up('sm')]: {
      fontSize: '14px',
    },
  },
}));

const ConnectButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  padding: theme.spacing(1.5, 3),
  fontSize: '1rem',
  fontWeight: 600,
  textTransform: 'none',
  boxShadow: theme.shadows[2],
  minHeight: 48,
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-1px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  // Mobile optimizations
  [theme.breakpoints.down('sm')]: {
    minHeight: 52,
    fontSize: '1.125rem',
  },
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  borderRadius: 20,
  fontWeight: 600,
  fontSize: '0.875rem',
  height: 32,
  '& .MuiChip-icon': {
    fontSize: '1.125rem',
  },
  [theme.breakpoints.down('sm')]: {
    height: 36,
    fontSize: '0.9375rem',
  },
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(4px)',
  zIndex: 10,
  borderRadius: 12,
}));

// Features data with MUI icons
const features = [
  {
    icon: <TrendingUpIcon />,
    title: 'Real-time Analytics',
    description: 'Get instant insights into your store performance with live data updates and comprehensive metrics tracking.',
  },
  {
    icon: <SecurityIcon />,
    title: 'Enterprise Security',
    description: 'Bank-level security with encrypted data transmission, secure authentication, and SOC 2 compliance.',
  },
  {
    icon: <NotificationsIcon />,
    title: 'Smart Notifications',
    description: 'Receive intelligent alerts for important changes, trends, and opportunities in your business.',
  },
  {
    icon: <AutoGraphIcon />,
    title: 'Predictive Intelligence',
    description: 'AI-powered forecasting helps you anticipate trends and make data-driven decisions.',
  },
  {
    icon: <DevicesIcon />,
    title: 'Mobile Optimized',
    description: 'Access your dashboard anywhere with our responsive design and mobile-first approach.',
  },
  {
    icon: <BoltIcon />,
    title: 'Lightning Fast',
    description: 'Optimized performance with sub-second load times and real-time data synchronization.',
  },
];

const HomePage = () => {
  const { isAuthenticated, shop, setShop, authLoading } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState<{ shopDomain?: string }>({});

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const shopParam = params.get('shop');
    const error = params.get('error');
    const redirectPath = params.get('redirect');

    if (error) {
      console.error('OAuth error:', error);
      setError('Authentication failed. Please try again.');
      return;
    }
    
    if (code && shopParam) {
      console.log('Processing OAuth callback with code:', code, 'shop:', shopParam);
      handleOAuthCallback(code, shopParam);
    } else if (redirectPath && isAuthenticated) {
      console.log('Redirecting authenticated user to:', redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [location.search, isAuthenticated, navigate]);

  const handleOAuthCallback = async (code: string, shop: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetchWithAuth('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, shop }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Authentication failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setShop(shop);
        addNotification('Successfully connected to Shopify!', 'success');
        
        // Redirect based on query parameter or default to dashboard
        const params = new URLSearchParams(location.search);
        const redirectPath = params.get('redirect');
        navigate(redirectPath || '/dashboard', { replace: true });
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      addNotification('Authentication failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchStore = () => {
    setShopDomain('');
    setError('');
    setFormErrors({});
  };

  const clearAllDashboardCache = () => {
    try {
      // Clear all cache keys that start with our cache prefix
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('dashboard_cache_') || key.startsWith('shopgauge_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
      console.log('Cleared all dashboard cache');
    } catch (error) {
      console.warn('Failed to clear dashboard cache:', error);
    }
  };

  const validateForm = (): boolean => {
    const errors: { shopDomain?: string } = {};
    
    if (!shopDomain.trim()) {
      errors.shopDomain = 'Shop domain is required';
    } else if (!shopDomain.includes('.myshopify.com') && !shopDomain.includes('.')) {
      errors.shopDomain = 'Please enter a valid Shopify domain (e.g., your-shop.myshopify.com)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Clear any existing cache when switching stores
      clearAllDashboardCache();

      const normalizedDomain = normalizeShopDomain(shopDomain.trim());
      console.log('Initiating Shopify OAuth for shop:', normalizedDomain);
      
      // Build OAuth URL with proper scopes and redirect handling
      const scopes = 'read_orders,read_products,read_customers,read_analytics,read_reports,read_inventory';
      const redirectUri = encodeURIComponent(`${window.location.origin}/`);
      
      // Check if there's a redirect parameter to preserve after login
      const params = new URLSearchParams(location.search);
      const redirectPath = params.get('redirect');
      
      const state = redirectPath ? encodeURIComponent(JSON.stringify({ redirect: redirectPath })) : '';
      
      const authUrl = `https://${normalizedDomain}/admin/oauth/authorize?` +
        `client_id=${encodeURIComponent(import.meta.env.VITE_SHOPIFY_API_KEY || '')}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `redirect_uri=${redirectUri}&` +
        `state=${state}&` +
        `response_type=code`;
      
      console.log('Redirecting to Shopify OAuth:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      addNotification('Failed to connect to Shopify. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // If user is already authenticated, show connected state
  if (isAuthenticated && shop) {
    return (
      <Box>
        <HeroSection>
          <HeroContent maxWidth="lg">
            <Fade in timeout={800}>
              <Box textAlign="center">
                <HeroTitle variant="h1">
                  Welcome back!
                </HeroTitle>
                <HeroSubtitle variant="h5" sx={{ mb: 4 }}>
                  Your store <strong>{shop}</strong> is connected and ready.
                </HeroSubtitle>
                
                <Stack 
                  direction={isMobile ? 'column' : 'row'} 
                  spacing={2} 
                  justifyContent="center"
                  alignItems="center"
                >
                  <StatusChip
                    icon={<CheckCircleIcon />}
                    label="Connected"
                    color="success"
                    variant="filled"
                  />
                  
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/dashboard')}
                    sx={{ 
                      borderRadius: 3,
                      px: 4,
                      py: 1.5,
                      fontSize: '1.125rem',
                      fontWeight: 600,
                      minWidth: isMobile ? '100%' : 'auto',
                    }}
                  >
                    View Dashboard
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={handleSwitchStore}
                    sx={{ 
                      borderRadius: 3,
                      px: 3,
                      py: 1.5,
                      fontSize: '1rem',
                      fontWeight: 600,
                      minWidth: isMobile ? '100%' : 'auto',
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      color: 'white',
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      },
                    }}
                  >
                    Switch Store
                  </Button>
                </Stack>
              </Box>
            </Fade>
          </HeroContent>
        </HeroSection>

        {/* Features Section for authenticated users */}
        <Box sx={{ py: { xs: 6, md: 8 }, backgroundColor: 'background.paper' }}>
          <Container maxWidth="lg">
            <Typography 
              variant="h3" 
              textAlign="center" 
              gutterBottom
              sx={{ 
                fontWeight: 700,
                mb: 4,
                color: 'text.primary'
              }}
            >
              Your Analytics Platform
            </Typography>
            
            <FeatureGrid>
              {features.slice(0, 3).map((feature, index) => (
                <Fade key={feature.title} in timeout={800 + index * 200}>
                  <FeatureCard>
                    <CardContent sx={{ p: 4, textAlign: 'center', height: '100%' }}>
                      <FeatureIcon>
                        {feature.icon}
                      </FeatureIcon>
                      
                      <Typography 
                        variant="h6" 
                        fontWeight={600} 
                        gutterBottom
                        sx={{ mb: 2 }}
                      >
                        {feature.title}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </FeatureCard>
                </Fade>
              ))}
            </FeatureGrid>
          </Container>
        </Box>
      </Box>
    );
  }

  // Show loading state during authentication
  if (authLoading) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'background.default'
      }}>
        <Box textAlign="center">
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Authenticating...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Default homepage for non-authenticated users
  return (
    <Box>
      <HeroSection>
        <HeroContent maxWidth="lg">
          <Fade in timeout={800}>
            <Box textAlign="center">
              <HeroTitle variant="h1">
                Enterprise Analytics for Shopify
              </HeroTitle>
              <HeroSubtitle variant="h5">
                Transform your store with AI-powered insights, competitor monitoring, 
                and real-time analytics designed for modern commerce.
              </HeroSubtitle>
            </Box>
          </Fade>
        </HeroContent>
      </HeroSection>

      {/* Connect Store Section */}
      <ConnectSection>
        <Container maxWidth="lg">
          <Typography 
            variant="h3" 
            textAlign="center" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              mb: 6,
              color: 'text.primary'
            }}
          >
            Connect Your Store
          </Typography>
          
          <ConnectCard>
            <ConnectForm onSubmit={handleLogin}>
              {error && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {error}
                </Alert>
              )}
              
              <Box sx={{ position: 'relative' }}>
                <StyledTextField
                  fullWidth
                  label="Your Shopify Domain"
                  placeholder="your-store.myshopify.com"
                      value={shopDomain}
                  onChange={(e) => {
                    setShopDomain(e.target.value);
                    if (formErrors.shopDomain) {
                      setFormErrors({ ...formErrors, shopDomain: undefined });
                    }
                  }}
                  error={!!formErrors.shopDomain}
                  helperText={formErrors.shopDomain}
                  disabled={loading}
                  autoComplete="url"
                  inputProps={{
                    'aria-label': 'Shopify store domain',
                  }}
                />
                
                {loading && (
                  <LoadingOverlay>
                    <CircularProgress size={24} />
                  </LoadingOverlay>
                )}
              </Box>
              
              <ConnectButton
                      type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                fullWidth
              >
                {loading ? 'Connecting...' : 'Connect to Shopify'}
              </ConnectButton>
              
              <Typography 
                variant="caption" 
                color="text.secondary" 
                textAlign="center"
                sx={{ mt: 1 }}
              >
                Secure connection via Shopify OAuth. We never store your credentials.
              </Typography>
            </ConnectForm>
          </ConnectCard>
        </Container>
      </ConnectSection>

      {/* Features Section */}
      <Box sx={{ py: { xs: 6, md: 10 }, backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography 
            variant="h3" 
            textAlign="center" 
            gutterBottom
            sx={{ 
              fontWeight: 700,
              mb: 6,
              color: 'text.primary'
            }}
          >
            Why Choose ShopGauge?
          </Typography>
          
          <FeatureGrid>
            {features.map((feature, index) => (
              <Fade key={feature.title} in timeout={800 + index * 200}>
                <FeatureCard>
                  <CardContent sx={{ p: 4, textAlign: 'center', height: '100%' }}>
                    <FeatureIcon>
                      {feature.icon}
                    </FeatureIcon>
                    
                    <Typography 
                      variant="h6" 
                      fontWeight={600} 
                      gutterBottom
                      sx={{ mb: 2 }}
                    >
                      {feature.title}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ lineHeight: 1.6 }}
                    >
                      {feature.description}
                    </Typography>
                  </CardContent>
                </FeatureCard>
              </Fade>
            ))}
          </FeatureGrid>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
