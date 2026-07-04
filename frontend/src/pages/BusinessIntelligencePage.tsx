import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import ChatMarkdown from '../components/ui/ChatMarkdown';
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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const location = useLocation();
  const askHandledRef = useRef(false);

  // Deep link from the command palette / "Explain this" affordances: /business-intelligence?ask=...
  // Auto-submits once data is ready (answers are generated locally, so this is free).
  useEffect(() => {
    if (askHandledRef.current) return;
    const ask = new URLSearchParams(location.search).get('ask');
    if (ask) {
      askHandledRef.current = true;
      setPendingAsk(ask);
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.search, location.pathname]);
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
      color: '#2f5bea',
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
      color: '#2f5bea',
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

  const getQuestionTone = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes('urgent')) {
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: 'rgba(245, 158, 11, 0.22)' };
    }
    if (normalized.includes('conversion') || normalized.includes('performance')) {
      return { bg: 'rgba(21, 184, 122, 0.12)', color: '#08734c', border: 'rgba(21, 184, 122, 0.22)' };
    }
    return { bg: 'rgba(47, 91, 234, 0.10)', color: '#2f5bea', border: 'rgba(47, 91, 234, 0.18)' };
  };

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

  // Flush a deep-linked question once store data is available
  useEffect(() => {
    if (pendingAsk && aggregatedData && !chatLoading) {
      const question = pendingAsk;
      setPendingAsk(null);
      handleChatSubmit(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAsk, aggregatedData]);

  const handleCopyMessage = (message: ChatMessage) => {
    navigator.clipboard?.writeText(message.content);
    setCopiedMessageId(message.id);
    setTimeout(() => setCopiedMessageId(null), 1800);
  };

  const formatMessageTime = (timestamp: Date) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const timeframeLabel =
    timeframeOptions.find((option) => option.value === selectedTimeframe)?.label.toLowerCase() ??
    'recent';

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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: { xs: 2, md: 3 },
          boxSizing: 'border-box',
          bgcolor: '#f6f7f9',
          minHeight: { xs: '100vh', lg: 'auto' },
          height: { lg: '100vh' },
          overflow: { lg: 'hidden' },
        }}
      >
        {/* Slim command header */}
        <Paper
          elevation={0}
          sx={{
            flexShrink: 0,
            px: { xs: 2, md: 3 },
            py: 1.75,
            borderRadius: 2,
            bgcolor: '#101820',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 56px -48px rgba(16,24,32,0.9)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #2f5bea 0%, #1539a6 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 12px 26px -14px rgba(47,91,234,0.9)',
              }}
            >
              <AIIcon sx={{ fontSize: 22, color: '#ffffff' }} />
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: '#9db4ff', fontWeight: 900, lineHeight: 1.4, display: 'block' }}>
                AI Analyst
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.05 }}>
                ShopGPT
              </Typography>
            </Box>
            {isDemoMode && (
              <Chip
                label="Demo"
                size="small"
                sx={{ ml: 0.5, bgcolor: 'rgba(47, 91, 234, 0.22)', color: '#b9c8ff', fontWeight: 800, border: '1px solid rgba(255,255,255,0.12)' }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#15b87a', boxShadow: '0 0 0 4px rgba(21,184,122,0.18)' }} />
              <Typography variant="caption" sx={{ color: '#c3ccd5', fontWeight: 700 }}>
                {isDemoMode ? 'Demo data' : 'Live data'}
                {aggregatedData?.metadata?.dataPoints ? ` · ${aggregatedData.metadata.dataPoints} points` : ''}
                {aggregatedData?.metadata?.timestamp
                  ? ` · updated ${new Date(aggregatedData.metadata.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: '#aab5c0', '&.Mui-focused': { color: '#7c9cff' } }}>Timeframe</InputLabel>
              <Select
                value={selectedTimeframe}
                label="Timeframe"
                onChange={(e) => setSelectedTimeframe(e.target.value as '24h' | '7d' | '30d' | '60d')}
                sx={{
                  color: '#ffffff',
                  fontWeight: 700,
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.22)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#7c9cff' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7c9cff' },
                  '.MuiSvgIcon-root': { color: '#ffffff' },
                }}
              >
                {timeframeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>

        {dataError && (
          <Alert
            severity="error"
            sx={{ flexShrink: 0, borderRadius: 2 }}
            action={
              <IconButton size="small" onClick={() => loadAggregatedData(true)} color="inherit">
                <RefreshIcon fontSize="small" />
              </IconButton>
            }
          >
            {dataError}
          </Alert>
        )}
        {dataLoading && !aggregatedData && <LinearProgress sx={{ flexShrink: 0, borderRadius: 1 }} />}

        {/* Workspace: chat + insights rail */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
            gap: 2,
            alignItems: 'stretch',
          }}
        >
          {/* Chat panel */}
          <Paper
            elevation={0}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: { xs: '65vh', lg: 0 },
              borderRadius: 2,
              border: '1px solid #e4e7eb',
              bgcolor: '#ffffff',
              overflow: 'hidden',
            }}
          >
            {/* Chat header strip */}
            <Box
              sx={{
                flexShrink: 0,
                px: 2.5,
                py: 1.5,
                borderBottom: '1px solid #e4e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#101820' }}>
                <BotIcon sx={{ fontSize: 18, color: '#7c9cff' }} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  ShopGPT Assistant
                </Typography>
                <Typography variant="caption" sx={{ color: '#5f6b76' }}>
                  Instant answers from your store data
                </Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Chip
                label="Ready"
                size="small"
                sx={{ bgcolor: 'rgba(21,184,122,0.12)', color: '#08734c', fontWeight: 800, height: 22 }}
              />
            </Box>

            {/* Messages */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                px: { xs: 2, md: 3 },
                py: 2.5,
                bgcolor: '#f9fafb',
              }}
            >
              {chatMessages.length === 0 && !chatLoading ? (
                <Box sx={{ maxWidth: 620, mx: 'auto', textAlign: 'center', pt: { xs: 1, md: 4 } }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      mx: 'auto',
                      borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #101820 0%, #1539a6 130%)',
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: '0 22px 44px -22px rgba(21,57,166,0.7)',
                    }}
                  >
                    <AIIcon sx={{ fontSize: 30, color: '#9db4ff' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, mt: 2 }}>
                    Ask anything about your store
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5f6b76', mt: 0.5, mb: 3 }}>
                    Revenue, products, competitors, and what to do next — answered instantly from your data.
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.25,
                      textAlign: 'left',
                    }}
                  >
                    {suggestedQuestions.map((question) => {
                      const tone = getQuestionTone(question.category);
                      const QuestionIcon = question.icon as React.ComponentType<{ sx?: object }>;
                      return (
                        <Box
                          key={question.text}
                          component="button"
                          type="button"
                          onClick={() => handleSuggestedQuestion(question.text)}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.25,
                            p: 1.5,
                            borderRadius: 1.5,
                            border: '1px solid #e4e7eb',
                            bgcolor: '#ffffff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                            '&:hover': {
                              borderColor: 'rgba(47,91,234,0.45)',
                              boxShadow: '0 14px 30px -24px rgba(16,24,32,0.6)',
                              transform: 'translateY(-1px)',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: 30,
                              height: 30,
                              borderRadius: 1,
                              flexShrink: 0,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: tone.bg,
                              color: tone.color,
                            }}
                          >
                            <QuestionIcon sx={{ fontSize: 17 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#101820', lineHeight: 1.4 }}>
                              {question.text}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700 }}>
                              {question.category}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <>
                  {chatMessages.map((message) => {
                    const isUser = message.type === 'user';
                    return (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          gap: 1.25,
                          mb: 2,
                          flexDirection: isUser ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          '&:hover .msg-actions': { opacity: 1 },
                        }}
                      >
                        <Avatar sx={{ width: 28, height: 28, bgcolor: isUser ? '#2f5bea' : '#101820' }}>
                          {isUser ? (
                            <PersonIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <BotIcon sx={{ fontSize: 16, color: '#7c9cff' }} />
                          )}
                        </Avatar>
                        <Box sx={{ maxWidth: '76%', minWidth: 0 }}>
                          <Box
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                              bgcolor: isUser ? '#2f5bea' : '#ffffff',
                              color: isUser ? '#ffffff' : '#101820',
                              border: isUser ? 'none' : '1px solid #e4e7eb',
                              boxShadow: '0 12px 26px -22px rgba(16,24,32,0.55)',
                            }}
                          >
                            {isUser ? (
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {message.content}
                              </Typography>
                            ) : message.isStreaming ? (
                              <>
                                <ChatMarkdown text={streamingMessage || '…'} />
                                <Box
                                  component="span"
                                  sx={{
                                    display: 'inline-block',
                                    width: 2,
                                    height: 14,
                                    ml: 0.25,
                                    bgcolor: '#2f5bea',
                                    animation: 'shopgptCaret 1s steps(2) infinite',
                                    '@keyframes shopgptCaret': { '50%': { opacity: 0 } },
                                  }}
                                />
                              </>
                            ) : (
                              <ChatMarkdown text={message.content} />
                            )}
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              mt: 0.5,
                              justifyContent: isUser ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: '#98a1ab' }}>
                              {formatMessageTime(message.timestamp)}
                            </Typography>
                            {!isUser && (
                              <IconButton
                                className="msg-actions"
                                size="small"
                                onClick={() => handleCopyMessage(message)}
                                sx={{ width: 22, height: 22, opacity: 0, transition: 'opacity 0.2s ease', color: '#98a1ab' }}
                                aria-label="Copy answer"
                              >
                                {copiedMessageId === message.id ? (
                                  <CheckIcon sx={{ fontSize: 13, color: '#15b87a' }} />
                                ) : (
                                  <CopyIcon sx={{ fontSize: 13 }} />
                                )}
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}

                  {/* Typing indicator */}
                  {chatLoading && !streamingMessage && (
                    <Box sx={{ display: 'flex', gap: 1.25, mb: 2, alignItems: 'center' }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: '#101820' }}>
                        <BotIcon sx={{ fontSize: 16, color: '#7c9cff' }} />
                      </Avatar>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderRadius: '14px 14px 14px 4px',
                          bgcolor: '#ffffff',
                          border: '1px solid #e4e7eb',
                          display: 'flex',
                          gap: 0.6,
                          alignItems: 'center',
                        }}
                      >
                        {[0, 1, 2].map((dot) => (
                          <Box
                            key={dot}
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: '#2f5bea',
                              animation: 'shopgptDot 1.2s ease-in-out infinite',
                              animationDelay: `${dot * 0.18}s`,
                              '@keyframes shopgptDot': {
                                '0%, 60%, 100%': { opacity: 0.25, transform: 'translateY(0)' },
                                '30%': { opacity: 1, transform: 'translateY(-3px)' },
                              },
                            }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Follow-up suggestions */}
                  {showSuggestions && !chatLoading && chatMessages.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {suggestedQuestions.slice(0, 4).map((question) => {
                        const tone = getQuestionTone(question.category);
                        return (
                          <Chip
                            key={question.text}
                            label={question.text}
                            onClick={() => handleSuggestedQuestion(question.text)}
                            sx={{
                              bgcolor: '#ffffff',
                              border: `1px solid ${tone.border}`,
                              color: tone.color,
                              fontWeight: 700,
                              maxWidth: '100%',
                              '&:hover': { bgcolor: tone.bg },
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </Box>

            {/* Composer */}
            <Box sx={{ flexShrink: 0, borderTop: '1px solid #e4e7eb', px: 2, pt: 1.5, pb: 1, bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  size="small"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about revenue, products, competitors, or next steps…"
                  disabled={chatLoading || !aggregatedData}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AIIcon sx={{ fontSize: 18, color: '#2f5bea' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: '#f6f7f9',
                      '&.Mui-focused': { bgcolor: '#ffffff' },
                    },
                  }}
                />
                <IconButton
                  onClick={() => handleChatSubmit()}
                  disabled={chatLoading || !chatInput.trim() || !aggregatedData}
                  aria-label="Send question"
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    bgcolor: '#2f5bea',
                    color: '#ffffff',
                    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: '0 12px 24px -16px rgba(47,91,234,0.85)',
                    '&:hover': { bgcolor: '#244bd4' },
                    '&.Mui-disabled': { bgcolor: '#e4e7eb', color: '#98a1ab', boxShadow: 'none' },
                  }}
                >
                  <SendIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: '#98a1ab', display: 'block', mt: 0.75 }}>
                Answers are generated from your store data. Enter to send · Shift+Enter for a new line.
              </Typography>
            </Box>
          </Paper>

          {/* Insights rail */}
          <Box
            sx={{
              minHeight: 0,
              overflowY: { lg: 'auto' },
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              pb: { xs: 1, lg: 0 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 0.5 }}>
              <Typography variant="overline" sx={{ color: '#5f6b76', fontWeight: 900, letterSpacing: '0.06em' }}>
                Auto insights
              </Typography>
              <IconButton
                size="small"
                onClick={() => generateAllInsights()}
                disabled={!aggregatedData || insightCards.some((card) => card.loading)}
                aria-label="Refresh all insights"
                sx={{ color: '#5f6b76' }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>

            {insightCards.map((card) => {
              const CardIcon = card.icon as React.ComponentType<{ sx?: object }>;
              const expanded = Boolean(expandedCards[card.id]);
              const content = card.insight?.insight || '';
              const isLong = content.length > 260;
              return (
                <Paper
                  key={card.id}
                  elevation={0}
                  sx={{
                    flexShrink: 0,
                    borderRadius: 2,
                    border: '1px solid #e4e7eb',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                    '&:hover': { boxShadow: '0 18px 40px -32px rgba(16,24,32,0.6)', borderColor: `${card.color}55` },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #eef0f3' }}>
                    <Box
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: `${card.color}14`,
                        color: card.color,
                        flexShrink: 0,
                      }}
                    >
                      <CardIcon sx={{ fontSize: 17 }} />
                    </Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, flex: 1, minWidth: 0 }}>
                      {card.title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => generateSingleInsight(card.id)}
                      disabled={card.loading || !aggregatedData}
                      aria-label={`Refresh ${card.title}`}
                      sx={{ color: '#98a1ab' }}
                    >
                      <RefreshIcon
                        sx={{
                          fontSize: 15,
                          animation: card.loading ? 'spin 1s linear infinite' : 'none',
                          '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                        }}
                      />
                    </IconButton>
                  </Box>

                  <Box sx={{ px: 2, py: 1.5 }}>
                    {card.loading ? (
                      <>
                        <Skeleton width="92%" />
                        <Skeleton width="80%" />
                        <Skeleton width="86%" />
                      </>
                    ) : card.error ? (
                      <Typography variant="caption" sx={{ color: '#b42318', fontWeight: 700 }}>
                        {card.error}
                      </Typography>
                    ) : content ? (
                      <>
                        <Box
                          sx={
                            expanded
                              ? {}
                              : {
                                  display: '-webkit-box',
                                  WebkitLineClamp: 5,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }
                          }
                        >
                          <ChatMarkdown text={content} />
                        </Box>
                        {isLong && (
                          <Typography
                            component="button"
                            type="button"
                            variant="caption"
                            onClick={() => setExpandedCards((prev) => ({ ...prev, [card.id]: !expanded }))}
                            sx={{
                              mt: 0.75,
                              border: 'none',
                              bgcolor: 'transparent',
                              color: '#2f5bea',
                              fontWeight: 800,
                              cursor: 'pointer',
                              p: 0,
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          >
                            {expanded ? 'Show less' : 'Show more'}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Typography variant="caption" sx={{ color: '#98a1ab' }}>
                        {card.description}
                      </Typography>
                    )}
                  </Box>

                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: '#f9fafb',
                      borderTop: '1px solid #eef0f3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700 }}>
                      From your {timeframeLabel} data
                    </Typography>
                    <Typography
                      component="button"
                      type="button"
                      variant="caption"
                      onClick={() => handleChatSubmit(`Tell me more about ${card.title.toLowerCase()}`)}
                      disabled={chatLoading || !aggregatedData}
                      sx={{
                        border: 'none',
                        bgcolor: 'transparent',
                        color: '#2f5bea',
                        fontWeight: 800,
                        cursor: 'pointer',
                        p: 0,
                        '&:hover': { textDecoration: 'underline' },
                        '&:disabled': { color: '#98a1ab', cursor: 'default' },
                      }}
                    >
                      Ask about this
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

export default BusinessIntelligencePage;
