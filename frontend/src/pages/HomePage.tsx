import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../api';
import { API_BASE_URL } from '../api';
import { useNotifications } from '../hooks/useNotifications';
import { normalizeShopDomain } from '../utils/normalizeShopDomain';
import IntelligentLoadingScreen from '../components/ui/IntelligentLoadingScreen';
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
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Business as BusinessIcon,
  CloudSync as CloudSyncIcon,
  Speed as SpeedIcon,
  ArrowForward as ArrowForwardIcon,
  Storefront as StorefrontIcon,
  Dashboard as DashboardIcon,
  SwapHoriz as SwapHorizIcon,
  ExpandMore as ExpandMoreIcon,
  Star as StarIcon,
  Group as GroupIcon,
  Shield as ShieldIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';

const HeroSection = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8, 2),
  background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
  color: theme.palette.text.primary,
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(6, 2),
  },
}));

const PricingBanner = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)',
  color: theme.palette.common.white,
  padding: theme.spacing(6),
  textAlign: 'center',
  borderRadius: theme.spacing(2),
  margin: theme.spacing(4, 0),
  position: 'relative',
  overflow: 'hidden',
  boxShadow: theme.shadows[6],
}));

const FeatureGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: theme.spacing(3),
  margin: theme.spacing(6, 0),
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
  },
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: theme.palette.primary.main,
  },
}));

const EnterpriseGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(3),
  margin: theme.spacing(6, 0),
  [theme.breakpoints.down('md')]: {
    gridTemplateColumns: '1fr',
  },
}));

const TestimonialCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(4),
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const ConnectStoreButton = styled(Button)(({ theme }) => ({
  background: 'rgba(255,255,255,0.9)',
  color: '#1d4ed8',
  padding: theme.spacing(1.5, 4),
  borderRadius: theme.spacing(2),
  fontWeight: 600,
  textTransform: 'none',
  border: '1px solid rgba(255,255,255,0.2)',
  boxShadow: theme.shadows[3],
  backdropFilter: 'blur(4px)',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: '#ffffff',
    boxShadow: theme.shadows[6],
    transform: 'translateY(-2px)',
  },
  '&:disabled': {
    opacity: 0.6,
    color: '#9ca3af',
  },
}));

// Updated feature categories based on actual backend capabilities
const featureCategories = [
  {
    icon: <AnalyticsIcon />,
    title: 'Real-Time Analytics',
    color: 'primary' as const,
    features: [
      'Track revenue trends with 60-day historical data',
      'Monitor orders, products, and inventory in real-time',
      'View conversion rates and customer behavior insights',
      'Get automated alerts for important business events'
    ]
  },
  {
    icon: <GroupIcon />,
    title: 'Team Collaboration',
    color: 'secondary' as const,
    features: [
      'Multiple team members can access simultaneously',
      'Private notifications for each team member',
      'No conflicts when working from different devices',
      'Secure session management for team privacy'
    ]
  },
  {
    icon: <PsychologyIcon />,
    title: 'Competitor Intelligence',
    color: 'info' as const,
    features: [
      'Automatically discover your competitors',
      'Track competitor pricing changes in real-time',
      'Get notified when competitors adjust prices',
      'Monitor competitor inventory and stock levels'
    ]
  },
  {
    icon: <ShieldIcon />,
    title: 'Enterprise Security',
    color: 'warning' as const,
    features: [
      'GDPR and CCPA compliance built-in',
      'Complete audit trail of all data access',
      'Customer data privacy controls',
      'Secure data export and deletion options'
    ]
  }
];

// Updated feature list based on actual backend endpoints and capabilities
const features = [
  'Real-time revenue tracking with 60-day historical trends',
  'Multi-user access with private session management',
  'Automated competitor discovery and price monitoring',
  'Advanced order analytics with filtering and search',
  'Conversion rate tracking with industry benchmarks',
  'Low inventory alerts and stock level monitoring',
  'New product analytics and performance tracking',
  'Comprehensive audit logging for compliance',
  'Customer data privacy controls and consent management',
  'Session-based notification system for team privacy',
  'Automated price change alerts from competitors',
  'Background competitor monitoring and discovery',
  'Smart competitor suggestion and approval workflow',
  'Data export capabilities for business reporting',
  'Enterprise-grade security and encryption',
  'Mobile-responsive dashboard for on-the-go access'
];

// More realistic testimonials based on actual features
const testimonials = [
  {
    text: "ShopGauge's team collaboration features let my marketing and sales teams work together without stepping on each other. The real-time revenue tracking shows us exactly where our growth is coming from.",
    author: "Sarah Chen, E-commerce Manager",
    metric: "Team productivity increased 35%",
    color: 'primary' as const
  },
  {
    text: "The competitor monitoring is incredible! I discovered 12 competitors I didn't know existed, and now I get alerts whenever they change prices. It's like having a market research team working 24/7.",
    author: "Mike Rodriguez, Store Owner",
    metric: "Discovered 12 new competitors automatically",
    color: 'secondary' as const
  },
  {
    text: "GDPR compliance was a nightmare until ShopGauge. The audit logging and privacy controls give me peace of mind when selling to European customers. Everything is documented and compliant.",
    author: "Emma Thompson, Compliance Officer",
    metric: "100% GDPR compliance achieved",
    color: 'info' as const
  }
];

const faqs = [
  {
    question: "How does the competitor discovery work?",
    answer: "Our system automatically finds your competitors by analyzing your product catalog and searching for similar businesses. It runs daily scans and notifies you of new competitors, price changes, and inventory updates."
  },
  {
    question: "What analytics data can I access?",
    answer: "You get comprehensive business insights including 60-day revenue trends, order analytics, conversion rates, inventory tracking, new product performance, and detailed competitor pricing data. All data is updated in real-time."
  },
  {
    question: "How does team collaboration work?",
    answer: "Multiple team members can access your dashboard simultaneously from different devices. Each person gets their own private session with personalized notifications, so there's no interference between team members."
  },
  {
    question: "Is my data secure and compliant?",
    answer: "Yes, we're fully GDPR/CCPA compliant with comprehensive audit logging, data privacy controls, TLS encryption, and customer consent tracking. You can export or delete customer data anytime."
  },
  {
    question: "How much does competitor monitoring cost?",
    answer: "Our intelligent system optimizes costs while maintaining accuracy. We use multiple data sources and smart caching to provide comprehensive competitor monitoring at a fraction of the cost of premium solutions."
  },
  {
    question: "Can I track inventory and new products?",
    answer: "Absolutely! We track low inventory items, monitor new products added in the last 30 days, and provide intelligent notifications for inventory management and product performance."
  }
];

const HomePage = () => {
  const [shopDomain, setShopDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const { isAuthenticated, authLoading, shop, logout, setShop } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notifications = useNotifications();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Check if we're in an OAuth flow from Shopify or if there's an error
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const shopFromUrl = urlParams.get('shop');
    const errorFromUrl = urlParams.get('error');
    const errorMsgFromUrl = urlParams.get('error_message');
    
    if (shopFromUrl && !authLoading) {
      console.log('HomePage: Detected OAuth callback, shop will be processed by AuthContext');
      setIsOAuthFlow(true);
    }
    
    if (errorFromUrl) {
      console.log('HomePage: OAuth error detected:', errorFromUrl, errorMsgFromUrl);
      setErrorCode(errorFromUrl);
      setErrorMessage(errorMsgFromUrl || `Authentication error: ${errorFromUrl}`);
      setIsOAuthFlow(false);
    }
  }, [location.search, authLoading]);

  // Handle redirect after successful authentication
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const urlParams = new URLSearchParams(location.search);
      const redirectPath = urlParams.get('redirect');
      
      if (redirectPath) {
        console.log('HomePage: Redirecting authenticated user to:', redirectPath);
        navigate(redirectPath, { replace: true });
      } else if (isOAuthFlow) {
        console.log('HomePage: OAuth flow complete, redirecting to dashboard');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, navigate, location.search, isOAuthFlow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!shopDomain.trim()) {
      setErrorMessage('Please enter your store domain');
      return;
    }

    const normalizedDomain = normalizeShopDomain(shopDomain);
    if (!normalizedDomain) {
      setErrorMessage('Please enter a valid Shopify store domain');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setErrorCode('');

    try {
      console.log('HomePage: Starting OAuth flow for shop:', normalizedDomain);
      
      const authUrl = `${API_BASE_URL}/api/auth/shopify/install?shop=${encodeURIComponent(normalizedDomain)}`;
      console.log('HomePage: Redirecting to:', authUrl);
      
      window.location.href = authUrl;
    } catch (error) {
      console.error('HomePage: Failed to initiate OAuth:', error);
      setErrorMessage('Failed to connect to Shopify. Please try again.');
      setIsLoading(false);
    }
  };

  // Show intelligent loading screen for OAuth flow instead of basic loading
  if (isLoading || isOAuthFlow) {
    return <IntelligentLoadingScreen />;
  }

  const showAuthConnected = isAuthenticated && !authLoading;

  return (
    <Box>
      <HeroSection>
        <Container maxWidth="md">
          <Fade in={true} timeout={1000}>
            <Typography variant={isMobile ? 'h3' : 'h2'} component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              ShopGauge
            </Typography>
          </Fade>
          <Fade in={true} timeout={1500}>
            <Typography variant={isMobile ? 'body1' : 'h6'} sx={{ mb: 4, maxWidth: '800px', mx: 'auto' }}>
              Transform your Shopify store with real-time analytics, automated competitor monitoring, and team collaboration tools. 
              Make data-driven decisions with comprehensive insights that help you stay ahead of the competition.
            </Typography>
          </Fade>
        </Container>
      </HeroSection>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Pricing Banner */}
        <PricingBanner elevation={8}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
            🚀 Limited Time Offer
          </Typography>
          <Typography variant="h6" gutterBottom sx={{ opacity: 0.9 }}>
            Start your 3-day free trial today and unlock enterprise-grade analytics!
          </Typography>
          {/* Price */}
          <Box sx={{ my: 3 }}>
            <Typography
              variant="h3"
              component="div"
              sx={{
                fontWeight: 'bold',
                background: 'linear-gradient(90deg,#fff 0%, #d1d5db 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              $19.99/month
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              after 3-day free trial
            </Typography>
          </Box>
          {/* Connection states inside banner */}
          {showAuthConnected && (
            <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(255,255,255,0.15)', px: 3, py: 1.5, borderRadius: 4 }}>
                <CheckCircleIcon sx={{ color: '#22c55e' }} />
                <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                  Connected to {shop || 'your store'}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <ConnectStoreButton onClick={() => navigate('/dashboard')} startIcon={<DashboardIcon />}>
                  Go to Dashboard
                </ConnectStoreButton>
                <ConnectStoreButton onClick={() => {
                  setShowConnectForm(true);
                }} startIcon={<SwapHorizIcon />} sx={{ bgcolor: 'rgba(255,255,255,0.8)', color: '#ef4444' }}>
                  Switch Store
                </ConnectStoreButton>
              </Stack>
            </Box>
          )}
          {/* CTA inside banner for unauthenticated */}
          {!showAuthConnected && !showConnectForm && (
            <ConnectStoreButton
              onClick={() => setShowConnectForm(true)}
              startIcon={<StorefrontIcon />}
              size="large"
            >
                          Connect Store
            </ConnectStoreButton>
          )}
          {showConnectForm && (
            <Card sx={{ maxWidth: 500, mx: 'auto', p: 3, mt: 4 }}>
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                    label="Your Shopify Store"
                    placeholder="Enter your store name (e.g., mystore or mystore.myshopify.com)"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      disabled={isLoading}
                    />
                  <ConnectStoreButton type="submit" disabled={isLoading || !normalizeShopDomain(shopDomain)}>
                    {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Connect Shopify Store'}
                  </ConnectStoreButton>
                </Stack>
                </form>
            </Card>
          )}
        </PricingBanner>

        {/* Enterprise-Grade Analytics Platform */}
        <Box sx={{ textAlign: 'center', my: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Enterprise-Grade Analytics Platform
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
            Built for modern e-commerce teams with advanced analytics, AI-powered insights, and enterprise security.
          </Typography>
          
          <EnterpriseGrid>
            {featureCategories.map((category, index) => (
              <FeatureCard key={index} elevation={2}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar sx={{ bgcolor: (theme) => theme.palette[category.color].main, mr: 2, width: 48, height: 48 }}>
                      {category.icon}
                    </Avatar>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
                      {category.title}
                    </Typography>
                  </Box>
                  <List dense>
                    {category.features.map((feature, idx) => (
                      <ListItem key={idx} sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckCircleIcon color={category.color} fontSize="small" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={feature} 
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </FeatureCard>
            ))}
          </EnterpriseGrid>
        </Box>

        {/* Complete Feature List */}
        <Box sx={{ textAlign: 'center', my: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Everything You Need to Succeed
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Comprehensive feature set designed for modern e-commerce success
          </Typography>
          
          <FeatureGrid>
            <Card elevation={2} sx={{ p: 3 }}>
              <List>
                {features.slice(0, 8).map((feature, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CheckCircleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
            </Card>
            <Card elevation={2} sx={{ p: 3 }}>
              <List>
                {features.slice(8).map((feature, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CheckCircleIcon color="secondary" />
                    </ListItemIcon>
                    <ListItemText primary={feature} />
                  </ListItem>
                ))}
              </List>
            </Card>
          </FeatureGrid>
        </Box>

        {/* Customer Testimonials */}
        <Box sx={{ textAlign: 'center', my: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            Trusted by E-commerce Professionals
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            See how ShopGauge is helping businesses make data-driven decisions
          </Typography>
          
          <FeatureGrid>
            {testimonials.map((testimonial, index) => (
              <TestimonialCard key={index} elevation={2}>
                <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic' }}>
                  "{testimonial.text}"
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: `${testimonial.color}.main`, mr: 2 }}>
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </Avatar>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                      {testimonial.author}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {testimonial.metric}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} sx={{ color: 'gold', fontSize: 20 }} />
                  ))}
                </Box>
              </TestimonialCard>
            ))}
          </FeatureGrid>
        </Box>

      {/* FAQ Section */}
        <Box sx={{ my: 8 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 4 }}>
            Frequently Asked Questions
          </Typography>
          
          {faqs.map((faq, index) => (
            <Accordion key={index} elevation={1} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                  {faq.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" color="text.secondary">
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;
