import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  Stack,
  IconButton,
  LinearProgress,
  Container,
  Paper,
  Chip,
  useTheme,
  useMediaQuery,
  Avatar,
  Skeleton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  BarChart3 as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  CircleDollarSign as CostIcon,
  Lightbulb as RecommendationIcon,
  RefreshCw as RefreshIcon,
  Sparkles as AIIcon,
  Send as SendIcon,
  User as PersonIcon,
  Bot as BotIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
  Store as StorefrontIcon,
  PackageCheck as InventoryIcon,
  ShoppingCart as OrdersIcon,
  ArrowRight as ArrowForwardIcon,
  type LucideIcon,
} from 'lucide-react';
import ChatMarkdown from '../components/ui/ChatMarkdown';
import { useAuth } from '../context/AuthContext';
import dataAggregationService from '../services/dataAggregationService';
import aiInsightsService from '../services/aiInsightsService';
import detectQuestionIntent from '../services/questionIntent';
import type { InsightDataType } from '../services/questionIntent';
import type { AggregatedDashboardData } from '../types/businessIntelligence';
import type { GeneratedInsight } from '../services/aiInsightsService';
import type { InsightRequest } from '../services/insightPromptTemplates';
import ErrorBoundary from '../components/ErrorBoundary';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  insight?: GeneratedInsight;
  contextUsed?: InsightDataType[];
  isStreaming?: boolean;
}

interface PromptCard {
  text: string;
  icon: LucideIcon;
  category: string;
}

type Timeframe = '24h' | '7d' | '30d' | '60d';

const SOURCE_META: Array<{ key: InsightDataType; label: string; icon: LucideIcon }> = [
  { key: 'revenue', label: 'Revenue', icon: TrendingUpIcon },
  { key: 'products', label: 'Products', icon: InventoryIcon },
  { key: 'orders', label: 'Orders', icon: OrdersIcon },
  { key: 'competitors', label: 'Competitors', icon: StorefrontIcon },
  { key: 'costs', label: 'Costs', icon: CostIcon },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

const relativeTime = (iso?: string): string => {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const BusinessIntelligencePage: React.FC = () => {
  const { isAuthenticated, shop, isDemoMode } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

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
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('7d');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const askHandledRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Right-rail state
  const [briefing, setBriefing] = useState<{ insight: GeneratedInsight | null; loading: boolean }>({
    insight: null,
    loading: false,
  });
  const [nextActions, setNextActions] = useState<{ insight: GeneratedInsight | null; loading: boolean }>({
    insight: null,
    loading: false,
  });

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

  const timeframeOptions = [
    { value: '24h' as const, label: 'Last 24 hours' },
    { value: '7d' as const, label: 'Last 7 days' },
    { value: '30d' as const, label: 'Last 30 days' },
    { value: '60d' as const, label: 'Last 60 days' },
  ];

  const detectTimeframeFromQuestion = (question: string): Timeframe => {
    const q = question.toLowerCase();
    if (
      q.includes('today') || q.includes('yesterday') || q.includes('last 24') ||
      q.includes('past day') || q.includes('recent') || q.includes('now') || q.includes('current')
    ) {
      return '24h';
    }
    if (
      q.includes('60') || q.includes('two months') || q.includes('last 2 months') ||
      q.includes('past 60') || q.includes('bi-month') || q.includes('bimonth')
    ) {
      return '60d';
    }
    if (
      q.includes('month') || q.includes('last 30') || q.includes('past month') ||
      q.includes('monthly') || q.includes('long term') || q.includes('overall') ||
      q.includes('total') || q.includes('all time')
    ) {
      return '30d';
    }
    return '7d';
  };

  const competitors = aggregatedData?.marketIntelligence?.competitors ?? [];
  const hasCompetitors = competitors.length > 0;

  // Which data sources ShopGPT can actually draw on right now
  const availableSources = useMemo(() => {
    if (!aggregatedData) return new Set<InsightDataType>();
    const set = new Set<InsightDataType>();
    const freshness = aggregatedData.metadata?.freshness || {};
    if ((freshness.revenue ?? 999) < 999 || aggregatedData.revenue?.total > 0) set.add('revenue');
    if ((freshness.products ?? 999) < 999 || aggregatedData.products?.total > 0) set.add('products');
    if ((freshness.orders ?? 999) < 999 || aggregatedData.orders?.total > 0) set.add('orders');
    if (hasCompetitors) set.add('competitors');
    if ((aggregatedData.marketIntelligence?.costs?.daily ?? 0) > 0) set.add('costs');
    return set;
  }, [aggregatedData, hasCompetitors]);

  // Live intent preview for the composer: show which sources will be used
  const composerContext = useMemo(() => {
    const trimmed = chatInput.trim();
    if (!trimmed) return null;
    return detectQuestionIntent(trimmed);
  }, [chatInput]);

  const promptCards = useMemo((): PromptCard[] => {
    const cards: PromptCard[] = [];
    if (hasCompetitors) {
      cards.push(
        {
          text: `How do I compare to my ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}?`,
          icon: StorefrontIcon,
          category: 'Competition',
        },
        { text: 'Am I overpriced compared to the market?', icon: AnalyticsIcon, category: 'Pricing' },
        { text: 'Which competitors are out of stock right now?', icon: InventoryIcon, category: 'Opportunity' }
      );
    }
    if ((aggregatedData?.products?.lowInventory ?? 0) > 0) {
      cards.push({
        text: `I have ${aggregatedData!.products.lowInventory} low-stock items. What should I do?`,
        icon: RecommendationIcon,
        category: 'Urgent',
      });
    }
    if ((aggregatedData?.orders?.abandonedCarts ?? 0) > 5) {
      cards.push({
        text: `How can I reduce my ${aggregatedData!.orders.abandonedCarts} abandoned carts?`,
        icon: OrdersIcon,
        category: 'Conversion',
      });
    }
    cards.push(
      { text: 'How is my revenue trending this week?', icon: TrendingUpIcon, category: 'Revenue' },
      { text: 'What are my top performing products?', icon: AnalyticsIcon, category: 'Performance' },
      { text: 'What should I focus on to increase revenue?', icon: RecommendationIcon, category: 'Growth' }
    );
    return cards.slice(0, 6);
  }, [aggregatedData, competitors.length, hasCompetitors]);

  const getQuestionTone = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes('urgent') || normalized.includes('opportunity')) {
      return { bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: 'rgba(245, 158, 11, 0.22)' };
    }
    if (normalized.includes('conversion') || normalized.includes('performance')) {
      return { bg: 'rgba(21, 184, 122, 0.12)', color: '#08734c', border: 'rgba(21, 184, 122, 0.22)' };
    }
    return { bg: 'rgba(47, 91, 234, 0.10)', color: '#2f5bea', border: 'rgba(47, 91, 234, 0.18)' };
  };

  useEffect(() => {
    if (shop && isAuthenticated) {
      loadAggregatedData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, isAuthenticated, isDemoMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  const generateRailInsights = useCallback(
    async (data: AggregatedDashboardData, timeframe: Timeframe) => {
      setBriefing((prev) => ({ ...prev, loading: true }));
      setNextActions((prev) => ({ ...prev, loading: true }));

      const build = (type: 'summary' | 'recommendations'): InsightRequest => ({
        type,
        data,
        context: { timeframe, focus: [type] },
      });

      const [summary, recommendations] = await Promise.all([
        aiInsightsService.generateInsight(build('summary')).catch(() => null),
        aiInsightsService.generateInsight(build('recommendations')).catch(() => null),
      ]);

      setBriefing({ insight: summary, loading: false });
      setNextActions({ insight: recommendations, loading: false });
    },
    []
  );

  const loadAggregatedData = useCallback(
    async (forceRefresh = true) => {
      if (!shop || !isAuthenticated) return;

      setDataLoading(true);
      setDataError(null);

      try {
        const data = await dataAggregationService.aggregateShopData(shop, forceRefresh);
        setAggregatedData(data);
        if (forceRefresh) {
          await generateRailInsights(data, selectedTimeframe);
        }
      } catch (error) {
        console.error('ShopGPT: failed to load aggregated data:', error);
        setDataError(
          isDemoMode
            ? 'Failed to load demo data. Please refresh the page.'
            : 'Failed to load business data. Please try again.'
        );
      } finally {
        setDataLoading(false);
      }
    },
    [shop, isAuthenticated, isDemoMode, selectedTimeframe, generateRailInsights]
  );

  // Regenerate briefing when timeframe changes
  useEffect(() => {
    if (aggregatedData) {
      generateRailInsights(aggregatedData, selectedTimeframe);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTimeframe]);

  const simulateStreamingText = (text: string) =>
    new Promise<void>((resolve) => {
      let currentIndex = 0;
      const words = text.split(' ');
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          setStreamingMessage(words.slice(0, currentIndex + 1).join(' '));
          currentIndex++;
        } else {
          setStreamingMessage('');
          clearInterval(interval);
          resolve();
        }
      }, 60);
    });

  const handleChatSubmit = async (question?: string) => {
    const messageText = (question || chatInput).trim();
    if (!messageText || !aggregatedData) return;

    setShowSuggestions(false);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const { intent, dataTypes } = detectQuestionIntent(messageText);
      const detectedTimeframe = detectTimeframeFromQuestion(messageText);

      const request: InsightRequest = {
        type: 'question',
        data: aggregatedData,
        userQuestion: messageText,
        context: {
          timeframe: detectedTimeframe,
          focus: [intent],
          intent,
          dataTypes,
          userQuestion: messageText,
        },
      };

      const insight = await aiInsightsService.generateInsight(request);

      const assistantMessageId = (Date.now() + 1).toString();
      const contextUsed = dataTypes.filter((dataType) => availableSources.has(dataType));
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        insight,
        contextUsed,
        isStreaming: true,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
      setChatLoading(false);

      await simulateStreamingText(insight.insight);

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: insight.insight, isStreaming: false } : msg
        )
      );

      setTimeout(() => setShowSuggestions(true), 500);
    } catch (error) {
      console.error('ShopGPT: chat insight generation failed:', error);
      setChatLoading(false);
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content:
            'I ran into an error answering that. Please try again or rephrase your question.',
          timestamp: new Date(),
        },
      ]);
      setTimeout(() => setShowSuggestions(true), 500);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleChatSubmit();
    }
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

  if (!isAuthenticated || !shop) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Please log in to access ShopGPT insights.</Alert>
      </Container>
    );
  }

  const sortedByGap = [...competitors].sort(
    (a, b) => Math.abs(b.percentDiff || 0) - Math.abs(a.percentDiff || 0)
  );
  const avgGap = hasCompetitors
    ? competitors.reduce((sum, c) => sum + (c.percentDiff || 0), 0) / competitors.length
    : 0;
  const outOfStockCount = competitors.filter((c) => !c.inStock).length;

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
        {/* Command header */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            flexDirection: { xs: 'column', md: 'row' },
            border: '1px solid rgba(255,255,255,0.10)',
            bgcolor: '#101820',
            backgroundImage: 'linear-gradient(135deg, #101820 0%, #0b1016 100%)',
            color: '#ffffff',
            borderRadius: 1,
            p: { xs: 2.5, md: 3 },
          }}
        >
          <Box sx={{ maxWidth: 640 }}>
            <Typography variant="overline" sx={{ color: '#9db4ff', fontWeight: 900 }}>
              AI Analyst
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.25, lineHeight: 1.15 }}>
              ShopGPT
            </Typography>
            <Typography variant="body2" sx={{ color: '#c3ccd5', mt: 1, maxWidth: 560 }}>
              Ask questions about revenue, orders, inventory, and competitors — answered from your store data.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', md: 'flex-end' }, gap: 1, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={isDemoMode ? 'Demo data' : 'Live data'}
                size="small"
                sx={{
                  bgcolor: isDemoMode ? 'rgba(47, 91, 234, 0.22)' : 'rgba(21,184,122,0.18)',
                  color: isDemoMode ? '#b9c8ff' : '#7fe0b6',
                  fontWeight: 800,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
              {aggregatedData?.metadata?.timestamp && (
                <Typography variant="caption" sx={{ color: '#8b96a2', whiteSpace: 'nowrap' }}>
                  Updated {relativeTime(aggregatedData.metadata.timestamp)}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {SOURCE_META.map(({ key, label, icon: SourceIcon }) => {
                  const active = availableSources.has(key);
                  const count = key === 'competitors' && hasCompetitors ? ` · ${competitors.length}` : '';
                  return (
                    <Tooltip
                      key={key}
                      title={active ? `${label} data connected` : `No ${label.toLowerCase()} data yet`}
                    >
                      <Chip
                        data-testid={`source-chip-${key}`}
                        size="small"
                        icon={<SourceIcon size={13} />}
                        label={`${label}${count}`}
                        sx={{
                          height: 24,
                          fontWeight: 800,
                          fontSize: 11,
                          bgcolor: active ? 'rgba(21,184,122,0.14)' : 'rgba(255,255,255,0.06)',
                          color: active ? '#7fe0b6' : '#6f7c88',
                          border: `1px solid ${active ? 'rgba(21,184,122,0.35)' : 'rgba(255,255,255,0.10)'}`,
                          '& .MuiChip-icon': { color: 'inherit' },
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel sx={{ color: '#aab5c0', '&.Mui-focused': { color: '#7c9cff' } }}>Timeframe</InputLabel>
                <Select
                  value={selectedTimeframe}
                  label="Timeframe"
                  onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
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
          </Box>
        </Box>

        {dataError && (
          <Alert
            severity="error"
            sx={{ flexShrink: 0, borderRadius: 2 }}
            action={
              <IconButton size="small" onClick={() => loadAggregatedData(true)} color="inherit">
                <RefreshIcon size={16} />
              </IconButton>
            }
          >
            {dataError}
          </Alert>
        )}
        {dataLoading && !aggregatedData && <LinearProgress sx={{ flexShrink: 0, borderRadius: 1 }} />}

        {/* Workspace: chat + briefing rail (chat first on mobile) */}
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
              minHeight: { xs: '70vh', lg: 0 },
              borderRadius: 2.5,
              border: '1px solid #e4e7eb',
              bgcolor: '#ffffff',
              overflow: 'hidden',
            }}
          >
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
                <Box sx={{ maxWidth: 640, mx: 'auto', textAlign: 'center', pt: { xs: 1, md: 4 } }}>
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      mx: 'auto',
                      borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #101820 0%, #1539a6 130%)',
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: '0 22px 44px -22px rgba(21,57,166,0.7)',
                    }}
                  >
                    <AIIcon size={28} color="#9db4ff" />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, mt: 2 }}>
                    Ask anything about your store
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#5f6b76', mt: 0.5, mb: 3 }}>
                    {hasCompetitors
                      ? `Answers draw on your revenue, products, orders, and ${competitors.length} monitored competitor${competitors.length > 1 ? 's' : ''}.`
                      : 'Answers draw on your live revenue, product, and order data.'}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                      gap: 1.25,
                      textAlign: 'left',
                    }}
                  >
                    {promptCards.map((card) => {
                      const tone = getQuestionTone(card.category);
                      const CardIcon = card.icon;
                      return (
                        <Box
                          key={card.text}
                          component="button"
                          type="button"
                          data-testid="prompt-card"
                          onClick={() => handleChatSubmit(card.text)}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.25,
                            p: 1.5,
                            borderRadius: 1.75,
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
                            <CardIcon size={17} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#101820', lineHeight: 1.4 }}>
                              {card.text}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700 }}>
                              {card.category}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  {!hasCompetitors && aggregatedData && (
                    <Box
                      data-testid="start-monitoring-cta"
                      sx={{
                        mt: 2,
                        p: 2,
                        borderRadius: 2,
                        border: '1px dashed rgba(47,91,234,0.4)',
                        bgcolor: 'rgba(47,91,234,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        textAlign: 'left',
                      }}
                    >
                      <StorefrontIcon size={22} color="#2f5bea" style={{ flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#101820' }}>
                          No competitors monitored yet
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#5f6b76' }}>
                          Add competitors to unlock pricing gaps, stock alerts, and market answers here.
                        </Typography>
                      </Box>
                      <Chip
                        label="Start monitoring"
                        onClick={() => navigate('/competitors')}
                        icon={<ArrowForwardIcon size={14} />}
                        sx={{
                          bgcolor: '#2f5bea',
                          color: '#ffffff',
                          fontWeight: 800,
                          flexShrink: 0,
                          '& .MuiChip-icon': { color: '#ffffff' },
                          '&:hover': { bgcolor: '#244bd4' },
                        }}
                      />
                    </Box>
                  )}
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
                          mb: 2.25,
                          flexDirection: isUser ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          '&:hover .msg-actions': { opacity: 1 },
                        }}
                      >
                        <Avatar sx={{ width: 28, height: 28, bgcolor: isUser ? '#2f5bea' : '#101820' }}>
                          {isUser ? (
                            <PersonIcon size={16} />
                          ) : (
                            <BotIcon size={16} color="#7c9cff" />
                          )}
                        </Avatar>
                        <Box sx={{ maxWidth: isMobile ? '85%' : '76%', minWidth: 0 }}>
                          <Box
                            sx={{
                              px: 2,
                              py: 1.5,
                              borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
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

                          {/* Context used + metadata */}
                          {!isUser && !message.isStreaming && (message.contextUsed?.length || message.insight) ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                              {(message.contextUsed || []).map((source) => {
                                const meta = SOURCE_META.find((s) => s.key === source);
                                if (!meta) return null;
                                const SourceIcon = meta.icon;
                                return (
                                  <Chip
                                    key={source}
                                    data-testid="context-chip"
                                    size="small"
                                    icon={<SourceIcon size={11} />}
                                    label={meta.label}
                                    sx={{
                                      height: 20,
                                      fontSize: 10.5,
                                      fontWeight: 800,
                                      bgcolor: 'rgba(47,91,234,0.08)',
                                      color: '#2f5bea',
                                      border: '1px solid rgba(47,91,234,0.16)',
                                      '& .MuiChip-icon': { color: 'inherit' },
                                    }}
                                  />
                                );
                              })}
                              {message.insight && (
                                <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700, ml: 0.25 }}>
                                  {message.insight.fromCache
                                    ? 'cached'
                                    : message.insight.source === 'local'
                                      ? 'computed locally'
                                      : `${Math.round(message.insight.confidence * 100)}% confidence`}
                                </Typography>
                              )}
                            </Box>
                          ) : null}

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
                            {!isUser && !message.isStreaming && (
                              <IconButton
                                className="msg-actions"
                                size="small"
                                onClick={() => handleCopyMessage(message)}
                                sx={{ width: 22, height: 22, opacity: 0, transition: 'opacity 0.2s ease', color: '#98a1ab' }}
                                aria-label="Copy answer"
                              >
                                {copiedMessageId === message.id ? (
                                  <CheckIcon size={13} color="#15b87a" />
                                ) : (
                                  <CopyIcon size={13} />
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
                        <BotIcon size={16} color="#7c9cff" />
                      </Avatar>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderRadius: '16px 16px 16px 4px',
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
                      {promptCards.slice(0, 4).map((card) => {
                        const tone = getQuestionTone(card.category);
                        return (
                          <Chip
                            key={card.text}
                            label={card.text}
                            onClick={() => handleChatSubmit(card.text)}
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
            <Box
              sx={{
                flexShrink: 0,
                borderTop: '1px solid #e4e7eb',
                px: 2,
                py: 1.5,
                bgcolor: '#ffffff',
                position: 'sticky',
                bottom: 0,
              }}
            >
              {composerContext && composerContext.dataTypes.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700, mr: 0.25 }}>
                    Will use:
                  </Typography>
                  {composerContext.dataTypes.map((source) => {
                    const meta = SOURCE_META.find((s) => s.key === source);
                    if (!meta) return null;
                    const active = availableSources.has(source);
                    return (
                      <Chip
                        key={source}
                        data-testid="composer-context-chip"
                        size="small"
                        label={meta.label}
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 800,
                          bgcolor: active ? 'rgba(47,91,234,0.08)' : '#f1f3f5',
                          color: active ? '#2f5bea' : '#98a1ab',
                          border: `1px solid ${active ? 'rgba(47,91,234,0.16)' : '#e4e7eb'}`,
                        }}
                      />
                    );
                  })}
                </Box>
              )}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end',
                  border: '1px solid #dfe3e8',
                  borderRadius: 3,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: '#f6f7f9',
                  transition: 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
                  '&:focus-within': {
                    bgcolor: '#ffffff',
                    borderColor: '#2f5bea',
                    boxShadow: '0 0 0 3px rgba(47,91,234,0.12)',
                  },
                }}
              >
                <Box
                  component="textarea"
                  rows={1}
                  value={chatInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    hasCompetitors
                      ? 'Ask about revenue, pricing vs competitors, stock, or next steps…'
                      : 'Ask about revenue, products, orders, or next steps…'
                  }
                  disabled={chatLoading || !aggregatedData}
                  aria-label="Ask ShopGPT"
                  sx={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    bgcolor: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 14.5,
                    lineHeight: 1.6,
                    py: 0.75,
                    maxHeight: 120,
                    color: '#101820',
                    '&::placeholder': { color: '#98a1ab' },
                    '&:disabled': { color: '#98a1ab', cursor: 'not-allowed' },
                  }}
                />
                <IconButton
                  onClick={() => handleChatSubmit()}
                  disabled={chatLoading || !chatInput.trim() || !aggregatedData}
                  aria-label="Send question"
                  sx={{
                    width: 38,
                    height: 38,
                    mb: 0.25,
                    borderRadius: 2,
                    bgcolor: '#2f5bea',
                    color: '#ffffff',
                    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
                    boxShadow: '0 12px 24px -16px rgba(47,91,234,0.85)',
                    '&:hover': { bgcolor: '#244bd4' },
                    '&.Mui-disabled': { bgcolor: '#e4e7eb', color: '#98a1ab', boxShadow: 'none' },
                  }}
                >
                  <SendIcon size={17} />
                </IconButton>
              </Box>
            </Box>
          </Paper>

          {/* Briefing rail */}
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
            {/* Business briefing */}
            <Paper
              elevation={0}
              data-testid="business-briefing"
              sx={{ flexShrink: 0, borderRadius: 2.5, border: '1px solid #e4e7eb', overflow: 'hidden' }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #eef0f3' }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(47,91,234,0.08)',
                    color: '#2f5bea',
                  }}
                >
                  <AnalyticsIcon size={17} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, flex: 1 }}>
                  Business briefing
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => aggregatedData && generateRailInsights(aggregatedData, selectedTimeframe)}
                  disabled={!aggregatedData || briefing.loading}
                  aria-label="Refresh briefing"
                  sx={{ color: '#98a1ab' }}
                >
                  <RefreshIcon size={15} className={briefing.loading ? 'animate-spin' : ''} />
                </IconButton>
              </Box>

              <Box sx={{ px: 2, py: 1.5 }}>
                {aggregatedData ? (
                  <Stack spacing={1} sx={{ mb: 1.5 }}>
                    {[
                      {
                        label: 'Revenue',
                        value: formatCurrency(aggregatedData.revenue?.total || 0),
                        detail: `${(aggregatedData.revenue?.growth || 0) >= 0 ? '+' : ''}${(aggregatedData.revenue?.growth || 0).toFixed(1)}% growth`,
                        positive: (aggregatedData.revenue?.growth || 0) >= 0,
                      },
                      {
                        label: 'Orders',
                        value: `${aggregatedData.orders?.total || 0}`,
                        detail: aggregatedData.orders?.conversionRate
                          ? `${aggregatedData.orders.conversionRate.toFixed(1)}% conversion`
                          : `${aggregatedData.orders?.abandonedCarts || 0} abandoned carts`,
                        positive: (aggregatedData.orders?.abandonedCarts || 0) <= 5,
                      },
                      {
                        label: 'Products',
                        value: `${aggregatedData.products?.total || 0}`,
                        detail:
                          (aggregatedData.products?.lowInventory || 0) > 0
                            ? `${aggregatedData.products.lowInventory} low stock`
                            : 'inventory healthy',
                        positive: (aggregatedData.products?.lowInventory || 0) === 0,
                      },
                    ].map((row) => (
                      <Box key={row.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 800, width: 64, flexShrink: 0 }}>
                          {row.label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#101820' }}>
                          {row.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: row.positive ? '#08734c' : '#b45309', fontWeight: 700 }}>
                          {row.detail}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <>
                    <Skeleton width="90%" />
                    <Skeleton width="70%" />
                  </>
                )}

                {briefing.loading ? (
                  <>
                    <Skeleton width="95%" />
                    <Skeleton width="85%" />
                  </>
                ) : briefing.insight ? (
                  <Box sx={{ pt: 1, borderTop: '1px solid #eef0f3' }}>
                    <ChatMarkdown text={briefing.insight.insight} />
                  </Box>
                ) : null}
              </Box>
            </Paper>

            {/* Market context */}
            <Paper
              elevation={0}
              data-testid="market-context"
              sx={{ flexShrink: 0, borderRadius: 2.5, border: '1px solid #e4e7eb', overflow: 'hidden' }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #eef0f3' }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(217,119,6,0.10)',
                    color: '#d97706',
                  }}
                >
                  <StorefrontIcon size={17} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, flex: 1 }}>
                  Market context
                </Typography>
                {hasCompetitors && (
                  <Chip
                    label={`${competitors.length} tracked`}
                    size="small"
                    sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: '#f1f3f5', color: '#5f6b76' }}
                  />
                )}
              </Box>

              <Box sx={{ px: 2, py: 1.5 }}>
                {!aggregatedData ? (
                  <>
                    <Skeleton width="90%" />
                    <Skeleton width="75%" />
                  </>
                ) : hasCompetitors ? (
                  <>
                    <Stack spacing={1.25}>
                      {sortedByGap.slice(0, 4).map((competitor) => {
                        const gap = competitor.percentDiff || 0;
                        return (
                          <Box key={`${competitor.url}-${competitor.name}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                flexShrink: 0,
                                bgcolor: competitor.inStock ? '#15b87a' : '#dc2626',
                              }}
                            />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 800, color: '#101820' }}>
                                {competitor.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#98a1ab', fontWeight: 700 }}>
                                {formatCurrency(competitor.price || 0)} · checked {relativeTime(competitor.lastChecked)}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={`${gap > 0 ? '+' : ''}${gap.toFixed(1)}%`}
                              sx={{
                                height: 20,
                                fontSize: 10.5,
                                fontWeight: 900,
                                bgcolor: gap < 0 ? 'rgba(220,38,38,0.10)' : 'rgba(21,184,122,0.12)',
                                color: gap < 0 ? '#b42318' : '#08734c',
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.25,
                        borderTop: '1px solid #eef0f3',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.75,
                      }}
                    >
                      <Chip
                        size="small"
                        label={`avg gap ${avgGap > 0 ? '+' : ''}${avgGap.toFixed(1)}%`}
                        sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: '#f1f3f5', color: '#5f6b76' }}
                      />
                      {outOfStockCount > 0 && (
                        <Chip
                          size="small"
                          label={`${outOfStockCount} out of stock`}
                          sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: 'rgba(220,38,38,0.10)', color: '#b42318' }}
                        />
                      )}
                      {(aggregatedData.marketIntelligence?.suggestions || 0) > 0 && (
                        <Chip
                          size="small"
                          label={`${aggregatedData.marketIntelligence.suggestions} suggestions`}
                          onClick={() => navigate('/competitors')}
                          sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: 'rgba(47,91,234,0.08)', color: '#2f5bea' }}
                        />
                      )}
                      {(aggregatedData.marketIntelligence?.costs?.daily || 0) > 0 && (
                        <Chip
                          size="small"
                          label={`$${aggregatedData.marketIntelligence.costs.daily.toFixed(2)}/day`}
                          sx={{ height: 20, fontSize: 10.5, fontWeight: 800, bgcolor: '#f1f3f5', color: '#5f6b76' }}
                        />
                      )}
                    </Box>
                    <Typography
                      component="button"
                      type="button"
                      variant="caption"
                      onClick={() => handleChatSubmit('How do I compare to my competitors?')}
                      disabled={chatLoading}
                      sx={{
                        mt: 1.25,
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
                      Ask ShopGPT about your market position
                    </Typography>
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="body2" sx={{ color: '#5f6b76', mb: 1.25 }}>
                      No competitors monitored yet. Add a few to see pricing gaps and stock alerts here.
                    </Typography>
                    <Chip
                      label="Start monitoring"
                      onClick={() => navigate('/competitors')}
                      icon={<ArrowForwardIcon size={14} />}
                      sx={{
                        bgcolor: '#2f5bea',
                        color: '#ffffff',
                        fontWeight: 800,
                        '& .MuiChip-icon': { color: '#ffffff' },
                        '&:hover': { bgcolor: '#244bd4' },
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Next best actions */}
            <Paper
              elevation={0}
              sx={{ flexShrink: 0, borderRadius: 2.5, border: '1px solid #e4e7eb', overflow: 'hidden' }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: '1px solid #eef0f3' }}>
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(21,184,122,0.10)',
                    color: '#059669',
                  }}
                >
                  <RecommendationIcon size={17} />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, flex: 1 }}>
                  Next best actions
                </Typography>
              </Box>
              <Box sx={{ px: 2, py: 1.5 }}>
                {nextActions.loading ? (
                  <>
                    <Skeleton width="92%" />
                    <Skeleton width="80%" />
                    <Skeleton width="86%" />
                  </>
                ) : nextActions.insight ? (
                  <ChatMarkdown text={nextActions.insight.insight} />
                ) : (
                  <Typography variant="caption" sx={{ color: '#98a1ab' }}>
                    Prioritized actions appear here once your data loads.
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>
    </ErrorBoundary>
  );
};

export default BusinessIntelligencePage;
