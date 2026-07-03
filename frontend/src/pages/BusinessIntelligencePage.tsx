import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  TextField,
  Stack,
  IconButton,
  LinearProgress,
  Container,
  Paper,
  Chip,
  Fade,
  useTheme,
  useMediaQuery,
  InputAdornment,
  Avatar,
  Skeleton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as CostIcon,
  Lightbulb as RecommendationIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AIIcon,
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import dataAggregationService from '../services/dataAggregationService';
import aiInsightsService from '../services/aiInsightsService';
import type { AggregatedDashboardData } from '../types/businessIntelligence';
import type { GeneratedInsight } from '../services/aiInsightsService';
import type { InsightRequest } from '../services/insightPromptTemplates';
import ErrorBoundary from '../components/ErrorBoundary';
import { debugLog } from '../components/ui/DebugPanel';

interface InsightCard {
  id: string;
  type: 'summary' | 'trends' | 'costs' | 'recommendations';
  title: string;
  description: string;
  icon: React.ComponentType;
  color: string;
  insight: GeneratedInsight | null;
  loading: boolean;
  error: string | null;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  insight?: GeneratedInsight;
  isStreaming?: boolean;
}

interface SuggestedQuestion {
  text: string;
  icon: React.ComponentType;
  category: string;
}

const BusinessIntelligencePage: React.FC = () => {
  const { isAuthenticated, shop, isDemoMode } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Data state
  const [aggregatedData, setAggregatedData] = useState<AggregatedDashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d' | '60d'>('7d');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timeframe options for user selection
  const timeframeOptions = [
    { value: '24h' as const, label: 'Last 24 Hours', description: 'Recent activity' },
    { value: '7d' as const, label: 'Last 7 Days', description: 'Weekly trends' },
    { value: '30d' as const, label: 'Last 30 Days', description: 'Monthly overview' },
    { value: '60d' as const, label: 'Last 60 Days', description: 'Two-month trend (default reporting window)' }
  ];

  // Smart timeframe detection based on user question
  const detectTimeframeFromQuestion = (question: string): '24h' | '7d' | '30d' | '60d' => {
    const lowerQuestion = question.toLowerCase();

    // Recent/immediate timeframes
    if (lowerQuestion.includes('today') || lowerQuestion.includes('yesterday') ||
        lowerQuestion.includes('last 24') || lowerQuestion.includes('past day') ||
        lowerQuestion.includes('recent') || lowerQuestion.includes('now') ||
        lowerQuestion.includes('current')) {
      return '24h';
    }

    // Two-month / 60 day timeframes
    if (lowerQuestion.includes('60') || lowerQuestion.includes('two months') || lowerQuestion.includes('last 2 months') ||
        lowerQuestion.includes('past 60') || lowerQuestion.includes('bi-month') || lowerQuestion.includes('bimonth')) {
      return '60d';
    }

    // Monthly timeframes
    if (lowerQuestion.includes('month') || lowerQuestion.includes('last 30') ||
        lowerQuestion.includes('past month') || lowerQuestion.includes('monthly') ||
        lowerQuestion.includes('long term') || lowerQuestion.includes('overall') ||
        lowerQuestion.includes('total') || lowerQuestion.includes('all time')) {
      return '30d';
    }

    // Default to weekly for most questions
    return '7d';
  };

  // Insight cards with subtle colors matching Market Intelligence theme
  const [insightCards, setInsightCards] = useState<InsightCard[]>([
    {
      id: 'summary',
      type: 'summary',
      title: 'Executive Summary',
      description: 'Key performance metrics and business overview',
      icon: AnalyticsIcon,
      color: '#2563eb', // Blue color matching Market Intelligence
      insight: null,
      loading: false,
      error: null
    },
    {
      id: 'trends',
      type: 'trends',
      title: 'Performance Trends',
      description: 'Revenue growth patterns and market dynamics',
      icon: TrendingUpIcon,
      color: '#059669', // Green color matching Market Intelligence
      insight: null,
      loading: false,
      error: null
    },
    {
      id: 'costs',
      type: 'costs',
      title: 'Cost Analysis',
      description: 'Market intelligence ROI and optimization opportunities',
      icon: CostIcon,
      color: '#d97706', // Orange color matching Market Intelligence
      insight: null,
      loading: false,
      error: null
    },
    {
      id: 'recommendations',
      type: 'recommendations',
      title: 'Strategic Recommendations',
      description: 'Prioritized action items for business growth',
      icon: RecommendationIcon,
      color: '#7c3aed', // Purple color for recommendations
      insight: null,
      loading: false,
      error: null
    }
  ]);

  // Suggested questions - dynamically generated based on data
  const getSuggestedQuestions = (): SuggestedQuestion[] => {
    const baseQuestions: SuggestedQuestion[] = [
      {
        text: "What are my top performing products today?",
        icon: TrendingUpIcon,
        category: "Performance"
      },
      {
        text: "How is my revenue trending this week?",
        icon: AnalyticsIcon,
        category: "Revenue"
      },
      {
        text: "What should I focus on to increase revenue?",
        icon: CostIcon,
        category: "Growth"
      },
      {
        text: "How can I optimize my business operations?",
        icon: RecommendationIcon,
        category: "Optimization"
      },
      {
        text: "What marketing strategies should I prioritize?",
        icon: AIIcon,
        category: "Strategy"
      }
    ];

    // Add context-specific questions based on aggregated data
    if (aggregatedData) {
      const contextQuestions: SuggestedQuestion[] = [];

      if (aggregatedData.products?.lowInventory > 0) {
        contextQuestions.push({
          text: `I have ${aggregatedData.products.lowInventory} low-stock items. What should I do?`,
          icon: RecommendationIcon,
          category: "Urgent"
        });
      }

      if (aggregatedData.marketIntelligence?.competitors?.length > 0) {
        contextQuestions.push({
          text: `How do I compare to my ${aggregatedData.marketIntelligence.competitors.length} competitors?`,
          icon: AnalyticsIcon,
          category: "Competition"
        });
      } else {
        contextQuestions.push({
          text: "Should I start monitoring competitors?",
          icon: AnalyticsIcon,
          category: "Market Intelligence"
        });
      }

      if (aggregatedData.orders?.abandonedCarts > 5) {
        contextQuestions.push({
          text: `How can I reduce my ${aggregatedData.orders.abandonedCarts} abandoned carts?`,
          icon: TrendingUpIcon,
          category: "Conversion"
        });
      }

      // Return context questions first, then base questions
      return [...contextQuestions.slice(0, 2), ...baseQuestions].slice(0, 6);
    }

    return baseQuestions;
  };

  const suggestedQuestions = getSuggestedQuestions();

  // Load data on component mount
  useEffect(() => {
    if (shop && isAuthenticated) {
      console.log('🤖 ShopGPT: Loading data', { shop, isDemoMode });
      loadAggregatedData();
    }
  }, [shop, isAuthenticated, isDemoMode]);



  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  const loadAggregatedData = useCallback(async (forceRefresh = true) => {
    if (!shop || !isAuthenticated) return;

    setDataLoading(true);
    setDataError(null);

    try {
      console.log('🔄 ShopGPT: Loading shop data', {
        shop,
        isDemoMode,
        forceRefresh,
        timestamp: new Date().toISOString()
      });

      const data = await dataAggregationService.aggregateShopData(shop, forceRefresh);

      console.log('✅ ShopGPT: Data loaded successfully', {
        shop: data.metadata.shop,
        revenue: data.revenue?.total,
        products: data.products?.total,
        orders: data.orders?.total,
        competitors: data.marketIntelligence?.competitors?.length,
        isDemoMode
      });

      setAggregatedData(data);

      // Auto-generate insights on initial load
      if (forceRefresh) {
        await generateAllInsights(data);
      }
    } catch (error) {
      console.error('❌ ShopGPT: Failed to load aggregated data:', error);
      setDataError(isDemoMode
        ? 'Failed to load demo data. Please refresh the page.'
        : 'Failed to load business data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [shop, isAuthenticated, isDemoMode]);

  const generateAllInsights = async (data?: AggregatedDashboardData) => {
    const dataToUse = data || aggregatedData;
    if (!dataToUse) return;

    // Set all cards to loading
    setInsightCards(prev => prev.map(card => ({
      ...card,
      loading: true,
      error: null
    })));

    try {
      const insights = await Promise.all(
        insightCards.map(async (card) => {
          const request: InsightRequest = {
            type: card.type,
            data: dataToUse,
            context: {
              timeframe: selectedTimeframe,
              focus: [card.type]
            }
          };

          try {
            return await aiInsightsService.generateInsight(request);
          } catch (error) {
            console.error(`Failed to generate ${card.type} insight:`, error);
            return null;
          }
        })
      );

      setInsightCards(prev => prev.map((card, index) => ({
        ...card,
        insight: insights[index] || null,
        loading: false,
        error: insights[index] ? null : 'Failed to generate insight'
      })));
    } catch (error) {
      console.error('Batch insight generation failed:', error);
      setInsightCards(prev => prev.map(card => ({
        ...card,
        loading: false,
        error: 'Failed to generate insights'
      })));
    }
  };

  // Regenerate insights when timeframe changes
  useEffect(() => {
    if (aggregatedData && selectedTimeframe) {
      generateAllInsights();
    }
  }, [selectedTimeframe, aggregatedData]);

  const generateSingleInsight = async (cardId: string) => {
    if (!aggregatedData) return;

    const card = insightCards.find(c => c.id === cardId);
    if (!card) return;

    setInsightCards(prev => prev.map(c =>
      c.id === cardId
        ? { ...c, loading: true, error: null }
        : c
    ));

    try {
      const request: InsightRequest = {
        type: card.type,
        data: aggregatedData,
        context: {
          timeframe: selectedTimeframe,
          focus: [card.type]
        }
      };

      const insight = await aiInsightsService.generateInsight(request);

      setInsightCards(prev => prev.map(c =>
        c.id === cardId
          ? { ...c, insight, loading: false, error: null }
          : c
      ));

    } catch (error) {
      console.error('Single insight generation failed:', error);
      setInsightCards(prev => prev.map(c =>
        c.id === cardId
          ? { ...c, loading: false, error: 'Failed to generate insight' }
          : c
      ));
    }
  };

  // Simulate streaming text effect
  const simulateStreamingText = (text: string, messageId: string) => {
    return new Promise<void>((resolve) => {
      let currentIndex = 0;
      const words = text.split(' ');

      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          const currentText = words.slice(0, currentIndex + 1).join(' ');
          setStreamingMessage(currentText);
          currentIndex++;
        } else {
          setStreamingMessage('');
          clearInterval(interval);
          resolve();
        }
      }, 80); // Adjust speed as needed
    });
  };

  // Determine insight type based on question content
  const determineInsightType = (question: string): InsightRequest['type'] => {
    const lowerQuestion = question.toLowerCase();

    // Check for cost/budget related keywords
    if (lowerQuestion.includes('cost') || lowerQuestion.includes('budget') ||
        lowerQuestion.includes('spend') || lowerQuestion.includes('expense') ||
        lowerQuestion.includes('roi') || lowerQuestion.includes('investment')) {
      return 'costs';
    }

    // Check for trend/growth related keywords
    if (lowerQuestion.includes('trend') || lowerQuestion.includes('growth') ||
        lowerQuestion.includes('performance') || lowerQuestion.includes('revenue') ||
        lowerQuestion.includes('sales') || lowerQuestion.includes('pattern')) {
      return 'trends';
    }

    // Check for recommendation/action related keywords
    if (lowerQuestion.includes('should') || lowerQuestion.includes('recommend') ||
        lowerQuestion.includes('improve') || lowerQuestion.includes('optimize') ||
        lowerQuestion.includes('what to do') || lowerQuestion.includes('how to')) {
      return 'recommendations';
    }

    // Default to summary for general questions
    return 'summary';
  };

  const handleChatSubmit = async (question?: string) => {
    const messageText = question || chatInput.trim();
    if (!messageText || !aggregatedData) return;

    // Hide suggestions while processing
    setShowSuggestions(false);

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Determine insight type and timeframe based on question content
      const insightType = determineInsightType(messageText);
      const detectedTimeframe = detectTimeframeFromQuestion(messageText);

      // Show timeframe detection if different from selected
      const timeframeChanged = detectedTimeframe !== selectedTimeframe;
      if (timeframeChanged) {
        console.log(`🎯 ShopGPT: Auto-detected timeframe: ${detectedTimeframe} (was ${selectedTimeframe})`);
      }

      console.log('🤖 ShopGPT: Processing question', {
        question: messageText,
        insightType,
        timeframe: detectedTimeframe,
        shop: aggregatedData.metadata.shop,
        isDemoMode,
        dataPoints: aggregatedData.metadata.dataPoints
      });

      const request: InsightRequest = {
        type: insightType,
        data: aggregatedData,
        context: {
          timeframe: detectedTimeframe,
          focus: [insightType],
          userQuestion: messageText // Pass the question for context
        }
      };

      const insight = await aiInsightsService.generateInsight(request);

      console.log('✅ ShopGPT: Generated insight', {
        source: insight.source,
        confidence: insight.confidence,
        fromCache: insight.fromCache,
        cost: insight.cost
      });

      // Create assistant message with streaming effect
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        insight,
        isStreaming: true
      };

      setChatMessages(prev => [...prev, assistantMessage]);
      setChatLoading(false);

      // Simulate streaming
      await simulateStreamingText(insight.insight, assistantMessageId);

      // Update with final content and show suggestions again
      setChatMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: insight.insight, isStreaming: false }
          : msg
      ));

      // Show suggestions again after answer is complete
      setTimeout(() => {
        setShowSuggestions(true);
      }, 500);

    } catch (error) {
      console.error('❌ ShopGPT: Chat insight generation failed:', error);
      setChatLoading(false);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: isDemoMode
          ? 'I apologize, but I encountered an error processing your question in demo mode. Please try refreshing the page or asking a different question.'
          : 'I apologize, but I encountered an error processing your question. Please try again or rephrase your question.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);

      // Show suggestions again even after error
      setTimeout(() => {
        setShowSuggestions(true);
      }, 500);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleChatSubmit();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setChatInput(question);
    handleChatSubmit(question);
  };

  if (!isAuthenticated || !shop) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please log in to access ShopGPT insights.
        </Alert>
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        backgroundColor: '#f6f7f9',
        py: { xs: 3, md: 4 }
      }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Paper
            sx={{
              mb: 3,
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.10)',
              bgcolor: '#101820',
              color: 'white',
              boxShadow: '0 28px 70px -52px rgb(16 24 32 / 0.9)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#2f5bea', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AIIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: '#9db4ff', fontWeight: 900 }}>
                    AI Analyst
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                    ShopGPT
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#c3ccd5', mt: 1 }}>
                    Ask questions about revenue, inventory, competitors, and next actions for {shop}.
                    {isDemoMode && (
                      <Chip
                        label="Demo"
                        size="small"
                        sx={{ ml: 1, verticalAlign: 'middle', bgcolor: 'rgba(47, 91, 234, 0.22)', color: '#b9c8ff', border: '1px solid rgba(255,255,255,0.12)' }}
                      />
                    )}
                  </Typography>
                </Box>
              </Box>

              {/* Timeframe Selector */}
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: '#aab5c0', '&.Mui-focused': { color: '#7c9cff' } }}>Timeframe</InputLabel>
                <Select
                  value={selectedTimeframe}
                  label="Timeframe"
                  onChange={(e) => setSelectedTimeframe(e.target.value as '24h' | '7d' | '30d')}
                  sx={{
                    color: '#ffffff',
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.20)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#7c9cff' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7c9cff' },
                    '.MuiSvgIcon-root': { color: '#ffffff' },
                    '& .MuiSelect-select': {
                      py: 1,
                      fontSize: '0.875rem'
                    }
                  }}
                >
                  {timeframeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {option.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Paper>

          {/* Data Context Info */}
          {aggregatedData && !dataLoading && (
            <Paper sx={{
              mb: 3,
              p: 2.5,
              borderRadius: 2,
              bgcolor: '#ffffff',
              border: '1px solid',
              borderColor: '#e4e7eb',
              boxShadow: '0 18px 42px -36px rgb(16 24 32 / 0.75)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AIIcon sx={{ fontSize: 20, color: isDemoMode ? 'primary.main' : 'secondary.main' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {isDemoMode ? 'Demo Data Active' : 'Live Data Connected'}
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Typography variant="caption" color="text.secondary">
                  Last updated: {new Date(aggregatedData.metadata.timestamp).toLocaleTimeString()}
                </Typography>
                <Divider orientation="vertical" flexItem />
                <Typography variant="caption" color="text.secondary">
                  {aggregatedData.metadata.dataPoints} data points
                </Typography>
                {aggregatedData.revenue && (
                  <>
                    <Divider orientation="vertical" flexItem />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Revenue: ${aggregatedData.revenue.total?.toLocaleString() || '0'}
                    </Typography>
                  </>
                )}
              </Box>
            </Paper>
          )}

          {/* Loading State */}
          {dataLoading && (
            <Box sx={{ mb: 3 }}>
              <Paper sx={{
                p: 3,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 'none',
              }}>
                <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
                <Typography variant="body2" sx={{
                  textAlign: 'center',
                  color: 'text.secondary',
                  fontWeight: 500
                }}>
                  {isDemoMode ? 'Loading demo data...' : 'Loading your business data...'}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Error State */}
          {dataError && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2,
              }}
            >
              {dataError}
            </Alert>
          )}

          {/* ChatGPT-style Interface */}
          {aggregatedData && (
            <Box>
              {/* Chat Container */}
              <Card sx={{
                mb: 4,
                minHeight: 500,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                boxShadow: '0 24px 58px -46px rgb(16 24 32 / 0.85)',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden'
              }}>
                {/* Chat Header */}
                <Box sx={{
                  p: 3,
                  borderBottom: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                  bgcolor: '#161c24',
                  color: '#ffffff'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{
                      bgcolor: '#2f5bea',
                      color: '#ffffff',
                      width: 40,
                      height: 40
                    }}>
                      <BotIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        ShopGPT Assistant
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#aab5c0' }}>
                        Powered by AI • Always learning
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Chat Messages Area */}
                <Box sx={{
                  flexGrow: 1,
                  p: 3,
                  overflowY: 'auto',
                  minHeight: 350,
                  maxHeight: 500,
                  bgcolor: '#f6f7f9'
                }}>
                  {/* Welcome Message */}
                  {chatMessages.length === 0 && (
                    <Fade in>
                      <Box>
                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                          <Avatar sx={{
                            bgcolor: '#101820',
                            color: '#9db4ff',
                            width: 32,
                            height: 32
                          }}>
                            <BotIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Paper sx={{
                              p: 3,
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              boxShadow: '0 18px 42px -36px rgb(16 24 32 / 0.75)',
                            }}>
                              <Typography variant="body1" sx={{ mb: 2 }}>
                                Hello! I'm your AI business analyst for **{aggregatedData?.metadata?.shop || shop}**. {isDemoMode && 'You\'re in demo mode - feel free to explore! '}I have access to your {aggregatedData && (
                                  <>
                                    revenue data (${aggregatedData.revenue?.total?.toLocaleString() || '0'}), {aggregatedData.products?.total || 0} products, {aggregatedData.orders?.total || 0} orders
                                    {aggregatedData.marketIntelligence?.competitors?.length > 0 && `, and ${aggregatedData.marketIntelligence.competitors.length} competitors`}
                                  </>
                                )}. I can help you understand performance trends, identify opportunities, and provide strategic recommendations. What would you like to know?
                              </Typography>

                              {/* Initial Suggested Questions - Market Intelligence Style */}
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
                                Suggested questions to get you started:
                              </Typography>
                              <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 1.5
                              }}>
                                {suggestedQuestions.map((q, idx) => {
                                  const IconComponent = q.icon;
                                  return (
                                    <Box
                                      key={idx}
                                      onClick={() => handleSuggestedQuestion(q.text)}
                                      sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: '#ffffff',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 1.5,
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                          borderColor: 'primary.light',
                                          boxShadow: '0 16px 34px -30px rgb(16 24 32 / 0.75)',
                                        }
                                      }}
                                    >
                                      <Box sx={{ color: 'primary.main', mt: 0.25, '& > *': { fontSize: '18px' } }}>
                                        <IconComponent />
                                      </Box>
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2" sx={{
                                          fontWeight: 500,
                                          lineHeight: 1.4,
                                          color: 'text.primary'
                                        }}>
                                          {q.text}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {q.category}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Paper>
                          </Box>
                        </Box>
                      </Box>
                    </Fade>
                  )}

                  {/* Chat Messages */}
                  {chatMessages.map((message) => (
                    <Box key={message.id} sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Avatar sx={{
                          bgcolor: message.type === 'user' ? '#2f5bea' : '#101820',
                          color: message.type === 'user' ? '#ffffff' : '#7c9cff',
                          width: 32,
                          height: 32
                        }}>
                          {message.type === 'user' ?
                            <PersonIcon sx={{ fontSize: 18 }} /> :
                            <BotIcon sx={{ fontSize: 18 }} />
                          }
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                            {message.type === 'user' ? 'You' : 'ShopGPT'} • {new Date(message.timestamp).toLocaleTimeString()}
                          </Typography>
                          <Paper sx={{
                            p: 2.5,
                            bgcolor: message.type === 'user'
                              ? 'rgba(47, 91, 234, 0.08)'
                              : '#ffffff',
                            borderRadius: 2,
                            border: message.type === 'user'
                              ? '1px solid rgba(37, 99, 235, 0.2)'
                              : '1px solid rgba(0, 0, 0, 0.05)',
                            boxShadow: 'none'
                          }}>
                            <Typography variant="body1" sx={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6
                            }}>
                              {message.isStreaming ? streamingMessage : message.content}
                              {message.isStreaming && (
                                <Box component="span" sx={{
                                  display: 'inline-block',
                                  width: 2,
                                  height: 16,
                                  bgcolor: 'primary.main',
                                  ml: 0.5,
                                  animation: 'blink 1s infinite',
                                  '@keyframes blink': {
                                    '0%, 50%': { opacity: 1 },
                                    '51%, 100%': { opacity: 0 }
                                  }
                                }} />
                              )}
                            </Typography>
                          </Paper>
                        </Box>
                      </Box>
                    </Box>
                  ))}

                  {/* Loading indicator */}
                  {chatLoading && (
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                      <Avatar sx={{
                        bgcolor: 'secondary.main',
                        width: 32,
                        height: 32
                      }}>
                        <BotIcon sx={{ fontSize: 18 }} />
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                          ShopGPT is thinking...
                        </Typography>
                        <Paper sx={{
                          p: 2.5,
                          bgcolor: '#ffffff',
                          borderRadius: 2,
                          border: '1px solid rgba(0, 0, 0, 0.05)',
                          boxShadow: 'none'
                        }}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {[0, 1, 2].map((i) => (
                              <Box
                                key={i}
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                  animation: 'pulse 1.5s ease-in-out infinite',
                                  animationDelay: `${i * 0.3}s`,
                                  '@keyframes pulse': {
                                    '0%, 80%, 100%': {
                                      opacity: 0.3,
                                      transform: 'scale(0.8)'
                                    },
                                    '40%': {
                                      opacity: 1,
                                      transform: 'scale(1)'
                                    }
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Paper>
                      </Box>
                    </Box>
                  )}

                  {/* Follow-up Suggestions */}
                  {showSuggestions && chatMessages.length > 0 && !chatLoading && (
                    <Fade in>
                      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, fontWeight: 500 }}>
                          Continue the conversation:
                        </Typography>
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 1.5
                        }}>
                          {suggestedQuestions.slice(0, 4).map((q, idx) => {
                            const IconComponent = q.icon;
                            return (
                              <Box
                                key={`followup-${idx}`}
                                onClick={() => handleSuggestedQuestion(q.text)}
                                sx={{
                                  p: 2,
                                  borderRadius: 2,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  bgcolor: 'background.paper',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                  '&:hover': {
                                    bgcolor: 'action.hover',
                                    borderColor: 'primary.light',
                                  }
                                }}
                              >
                                <Box sx={{ color: 'primary.main', '& > *': { fontSize: '16px' } }}>
                                  <IconComponent />
                                </Box>
                                <Typography variant="body2" sx={{
                                  fontWeight: 500,
                                  fontSize: '0.8rem',
                                  color: 'text.primary'
                                }}>
                                  {q.text}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    </Fade>
                  )}

                  <div ref={chatEndRef} />
                </Box>

                {/* Chat Input */}
                <Box sx={{
                  p: 3,
                  borderTop: 1,
                  borderColor: 'divider',
                  bgcolor: '#ffffff'
                }}>
                  <TextField
                    fullWidth
                    placeholder="Ask me anything about your business performance, trends, or get strategic advice..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={!aggregatedData || chatLoading}
                    multiline
                    maxRows={3}
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AIIcon sx={{ color: '#2f5bea' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => handleChatSubmit()}
                            disabled={!chatInput.trim() || chatLoading}
                            sx={{
                              color: '#2f5bea',
                              '&.Mui-disabled': {
                                color: 'action.disabled'
                              }
                            }}
                          >
                            <SendIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                      sx: {
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: 'divider',
                          borderRadius: 2
                        },
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.1)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                          boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
                        }
                      }
                    }}
                  />
                </Box>
              </Card>

              {/* Insight Cards - Below Chat */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                  <AIIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    AI-Generated Insights
                  </Typography>
                </Box>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    lg: 'repeat(4, 1fr)'
                  },
                  gap: 3,
                  alignItems: 'stretch' // Ensure all cards have equal height
                }}>
                  {insightCards.map((card) => {
                    const IconComponent = card.icon;
                    // Generate background and border colors based on card color (matching Market Intelligence)
                    const getCardColors = (color: string) => {
                      switch (color) {
                        case '#2563eb': // Blue
                          return { bg: 'rgba(37, 99, 235, 0.05)', border: 'rgba(37, 99, 235, 0.1)', iconBg: 'rgba(37, 99, 235, 0.1)' };
                        case '#059669': // Green
                          return { bg: 'rgba(5, 150, 105, 0.05)', border: 'rgba(5, 150, 105, 0.1)', iconBg: 'rgba(5, 150, 105, 0.1)' };
                        case '#d97706': // Orange
                          return { bg: 'rgba(217, 119, 6, 0.05)', border: 'rgba(217, 119, 6, 0.1)', iconBg: 'rgba(217, 119, 6, 0.1)' };
                        case '#7c3aed': // Purple
                          return { bg: 'rgba(124, 58, 237, 0.05)', border: 'rgba(124, 58, 237, 0.1)', iconBg: 'rgba(124, 58, 237, 0.1)' };
                        default:
                          return { bg: 'rgba(0, 0, 0, 0.02)', border: 'rgba(0, 0, 0, 0.1)', iconBg: 'rgba(0, 0, 0, 0.1)' };
                      }
                    };

                    const colors = getCardColors(card.color);

                    return (
                      <Card key={card.id} sx={{
                        height: '100%',
                        minHeight: 280, // Ensure minimum consistent height
                        position: 'relative',
                        borderRadius: 2,
                        border: `1px solid ${colors.border}`,
                        bgcolor: colors.bg,
                        transition: 'all 0.2s ease-in-out',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          boxShadow: '0 4px 12px -2px rgb(15 23 42 / 0.10)',
                          borderColor: card.color
                        }
                      }}>
                        <CardContent sx={{
                          p: 3,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          {/* Card Header - Market Intelligence style */}
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            mb: 3
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, width: '100%' }}>
                              <Box sx={{
                                p: 1.5,
                                borderRadius: 2,
                                bgcolor: colors.iconBg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Box sx={{ color: card.color, '& > *': { fontSize: '24px' } }}>
                                  <IconComponent />
                                </Box>
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="h6" sx={{
                                  fontWeight: 600,
                                  color: 'text.primary',
                                  fontSize: '1rem',
                                  mb: 0.5,
                                  lineHeight: 1.2
                                }}>
                                  {card.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{
                                  lineHeight: 1.3,
                                  display: 'block',
                                  fontSize: '0.75rem'
                                }}>
                                  {card.description}
                                </Typography>
                              </Box>
                            </Box>


                          </Box>

                          {/* Content - Flexible height */}
                          <Box sx={{
                            flexGrow: 1,
                            display: 'flex',
                            alignItems: card.insight || card.error ? 'flex-start' : 'center',
                            minHeight: 100
                          }}>
                            {card.loading && (
                              <Box sx={{ width: '100%' }}>
                                <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
                                <Skeleton variant="text" height={20} sx={{ mb: 1 }} />
                                <Skeleton variant="text" height={20} width="60%" />
                              </Box>
                            )}

                            {card.error && (
                              <Alert severity="error" sx={{
                                py: 1,
                                px: 2,
                                borderRadius: 2,
                                fontSize: '0.875rem',
                                width: '100%'
                              }}>
                                {card.error}
                              </Alert>
                            )}

                            {card.insight && !card.loading && (
                              <Box sx={{ width: '100%' }}>
                                <Typography variant="body2" sx={{
                                  color: 'text.primary',
                                  lineHeight: 1.5,
                                  fontSize: '0.875rem',
                                  mb: 1.5
                                }}>
                                  {card.insight.insight}
                                </Typography>

                                {/* Insight metadata footer */}
                                <Box sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  pt: 1.5,
                                  borderTop: '1px solid',
                                  borderColor: 'divider',
                                  flexWrap: 'nowrap',
                                  minWidth: 0
                                }}>
                                  {debugLog.isEnabled() && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Chip
                                        label={card.insight.source === 'ai' ? 'AI Generated' :
                                               card.insight.source === 'local' ? 'Rule-Based' :
                                               'Fallback'}
                                        size="small"
                                        sx={{
                                          fontSize: '0.7rem',
                                          height: 20,
                                          bgcolor: card.insight.source === 'ai' ? 'rgba(37, 99, 235, 0.1)' :
                                                   card.insight.source === 'local' ? 'rgba(5, 150, 105, 0.1)' :
                                                   'rgba(156, 163, 175, 0.1)',
                                          color: card.insight.source === 'ai' ? 'primary.main' :
                                                 card.insight.source === 'local' ? 'success.main' :
                                                 'text.secondary'
                                        }}
                                      />
                                      {card.insight.fromCache && (
                                        <Chip
                                          label="Cached"
                                          size="small"
                                          sx={{
                                            fontSize: '0.7rem',
                                            height: 20,
                                            bgcolor: 'rgba(217, 119, 6, 0.1)',
                                            color: 'warning.main'
                                          }}
                                        />
                                      )}
                                    </Box>
                                  )}
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: 'auto', fontSize: '0.72rem' }}
                                  >
                                    Insight confidence: {Math.round((card.insight.confidence || 0) * 100)}%
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={() => generateSingleInsight(card.id)}
                                    sx={{
                                      ml: 1,
                                      p: 0.5,
                                      color: card.color
                                    }}
                                  >
                                    <RefreshIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                              </Box>
                            )}

                            {!card.insight && !card.loading && !card.error && (
                              <Box sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'text.disabled',
                                width: '100%',
                                textAlign: 'center'
                              }}>
                                <Box sx={{ color: card.color, mb: 1 }}>
                                  <AIIcon style={{ fontSize: 32, opacity: 0.3 }} />
                                </Box>
                                <Typography variant="caption">
                                  Click refresh to generate insights
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </Container>
      </Box>
    </ErrorBoundary>
  );
};

export default BusinessIntelligencePage;
