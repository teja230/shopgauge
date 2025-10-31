import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Button,
  TextField,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  Collapse,
  LinearProgress
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  MonetizationOn as CostIcon,
  Lightbulb as RecommendationIcon,
  Chat as ChatIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as SpeedIcon,
  CachedOutlined as CacheIcon,
  Savings as SavingsIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import dataAggregationService from '../../services/dataAggregationService';
import type { AggregatedDashboardData } from '../../types/businessIntelligence';
import aiInsightsService from '../../services/aiInsightsService';
import type { GeneratedInsight, CostMetrics } from '../../services/aiInsightsService';
import type { InsightRequest } from '../../services/insightPromptTemplates';
import { debugLog } from './DebugPanel';

interface InsightCard {
  id: string;
  type: 'summary' | 'trends' | 'costs' | 'recommendations';
  title: string;
  icon: React.ElementType;
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
}

const BusinessInsightsGenerator: React.FC = () => {
  const { shop } = useAuth();
  const [aggregatedData, setAggregatedData] = useState<AggregatedDashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // Insight cards
  const [insightCards, setInsightCards] = useState<InsightCard[]>([
    { id: 'summary', type: 'summary', title: 'Executive Summary', icon: AnalyticsIcon, insight: null, loading: false, error: null },
    { id: 'trends', type: 'trends', title: 'Trends Analysis', icon: TrendingUpIcon, insight: null, loading: false, error: null },
    { id: 'costs', type: 'costs', title: 'Cost Optimization', icon: CostIcon, insight: null, loading: false, error: null },
    { id: 'recommendations', type: 'recommendations', title: 'Strategic Recommendations', icon: RecommendationIcon, insight: null, loading: false, error: null }
  ]);
  
  // Chat interface
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Settings
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [batchMode, setBatchMode] = useState(true);
  const [showCostMetrics, setShowCostMetrics] = useState(false);
  const [costMetrics, setCostMetrics] = useState<CostMetrics>({ totalCost: 0, requestCount: 0, averageCost: 0, cacheHitRate: 0, tokensSaved: 0 });
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load data on component mount
  useEffect(() => {
    if (shop) {
      loadAggregatedData();
      
      if (autoRefresh) {
        refreshIntervalRef.current = setInterval(() => {
          loadAggregatedData(false);
        }, 10 * 60 * 1000); // 10 minutes
      }
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [shop, autoRefresh]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadAggregatedData = useCallback(async (forceRefresh = true) => {
    if (!shop) return;
    
    setDataLoading(true);
    setDataError(null);
    
    try {
      debugLog.info('Loading aggregated data', { shop, forceRefresh }, 'BusinessInsights');
      const data = await dataAggregationService.aggregateShopData(shop, forceRefresh);
      setAggregatedData(data);
      
      // Auto-generate insights if this is initial load
      if (forceRefresh && batchMode) {
        await generateAllInsights(data);
      }
    } catch (error) {
      console.error('Failed to load aggregated data:', error);
      setDataError('Failed to load business data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [shop, batchMode]);

  const generateAllInsights = async (data?: AggregatedDashboardData) => {
    const dataToUse = data || aggregatedData;
    if (!dataToUse) return;
    
          debugLog.info('Generating all insights in batch mode', undefined, 'BusinessInsights');
    
    // Set all cards to loading
    setInsightCards(prev => prev.map(card => ({
      ...card,
      loading: true,
      error: null
    })));
    
    const requests: InsightRequest[] = insightCards.map(card => ({
      type: card.type,
      data: dataToUse,
      context: {
        timeframe: '7d',
        focus: [card.type]
      }
    }));
    
    try {
      const insights = await aiInsightsService.generateBatchInsights(requests);
      
      // Update cards with insights
      setInsightCards(prev => prev.map((card, index) => ({
        ...card,
        insight: insights[index] || null,
        loading: false,
        error: insights[index] ? null : 'Failed to generate insight'
      })));
      
      // Update cost metrics
      setCostMetrics(aiInsightsService.getCostMetrics());
      
    } catch (error) {
      console.error('Batch insight generation failed:', error);
      setInsightCards(prev => prev.map(card => ({
        ...card,
        loading: false,
        error: 'Failed to generate insights'
      })));
    }
  };

  const generateSingleInsight = async (cardId: string) => {
    if (!aggregatedData) return;
    
    const card = insightCards.find(c => c.id === cardId);
    if (!card) return;
    
          debugLog.info('Generating single insight', { cardId, type: card.type }, 'BusinessInsights');
    
    // Set specific card to loading
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
          timeframe: '7d',
          focus: [card.type]
        }
      };
      
      const insight = await aiInsightsService.generateInsight(request);
      
      setInsightCards(prev => prev.map(c => 
        c.id === cardId 
          ? { ...c, insight, loading: false, error: null }
          : c
      ));
      
      setCostMetrics(aiInsightsService.getCostMetrics());
      
    } catch (error) {
      console.error('Single insight generation failed:', error);
      setInsightCards(prev => prev.map(c => 
        c.id === cardId 
          ? { ...c, loading: false, error: 'Failed to generate insight' }
          : c
      ));
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !aggregatedData || chatLoading) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);
    
    try {
      debugLog.info('Processing chat question', { question: userMessage.content }, 'BusinessInsights');
      
      const request: InsightRequest = {
        type: 'question',
        data: aggregatedData,
        userQuestion: userMessage.content,
        context: {
          timeframe: '7d',
          focus: ['all']
        }
      };
      
      const insight = await aiInsightsService.generateInsight(request);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: insight.insight,
        timestamp: new Date(),
        insight
      };
      
      setChatMessages(prev => [...prev, assistantMessage]);
      setCostMetrics(aiInsightsService.getCostMetrics());
      
    } catch (error) {
      console.error('Chat insight generation failed:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your question. Please try again or rephrase your question.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleChatSubmit();
    }
  };

  const formatCost = (cost: number): string => {
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(3)}`;
  };

  const getConfidenceColor = (confidence: number): 'success' | 'warning' | 'error' => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai': return <AnalyticsIcon fontSize="small" />;
      case 'local': return <SpeedIcon fontSize="small" />;
      case 'fallback': return <CacheIcon fontSize="small" />;
      default: return <AnalyticsIcon fontSize="small" />;
    }
  };

  if (!shop) {
    return (
      <Alert severity="warning">
        Please select a shop to view business insights.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with controls */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AnalyticsIcon />
          Business Intelligence Dashboard
        </Typography>
        
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => loadAggregatedData(true)}
            disabled={dataLoading}
          >
            Refresh Data
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => generateAllInsights()}
            disabled={!aggregatedData || dataLoading}
          >
            Generate All Insights
          </Button>
          
          <FormControlLabel
            control={
              <Switch
                checked={batchMode}
                onChange={(e) => setBatchMode(e.target.checked)}
              />
            }
            label="Batch Mode"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto Refresh"
          />
          
          <Button
            variant="text"
            startIcon={showCostMetrics ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowCostMetrics(!showCostMetrics)}
          >
            Cost Metrics
          </Button>
        </Stack>
        
        {/* Cost Metrics Panel */}
        <Collapse in={showCostMetrics}>
          <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom>AI Cost Metrics</Typography>
            <Stack direction="row" spacing={4} flexWrap="wrap">
              <Box>
                <Typography variant="body2" color="text.secondary">Total Cost</Typography>
                <Typography variant="h6">{formatCost(costMetrics.totalCost)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Requests</Typography>
                <Typography variant="h6">{costMetrics.requestCount}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Average Cost</Typography>
                <Typography variant="h6">{formatCost(costMetrics.averageCost)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Cache Hit Rate</Typography>
                <Typography variant="h6">{costMetrics.cacheHitRate.toFixed(1)}%</Typography>
              </Box>
            </Stack>
          </Paper>
        </Collapse>
      </Box>

      {/* Data loading */}
      {dataLoading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading business data...
          </Typography>
        </Box>
      )}

      {/* Data error */}
      {dataError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {dataError}
        </Alert>
      )}

      {/* Insight Cards */}
      {aggregatedData && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Automated Insights
          </Typography>
          
          <Stack spacing={2}>
            {insightCards.map((card) => {
              const IconComponent = card.icon;
              return (
                <Card key={card.id} sx={{ position: 'relative' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconComponent color="primary" />
                        <Typography variant="h6">{card.title}</Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {card.insight && (
                          <>
                            {debugLog.isEnabled() && (
                              <Chip
                                size="small"
                                icon={getSourceIcon(card.insight.source)}
                                label={card.insight.source.toUpperCase()}
                                color={card.insight.fromCache ? 'success' : 'primary'}
                              />
                            )}
                            <Chip
                              size="small"
                              label={`${Math.round(card.insight.confidence * 100)}%`}
                              color={getConfidenceColor(card.insight.confidence)}
                            />
                            {debugLog.isEnabled() && card.insight.cost > 0 && (
                              <Chip
                                size="small"
                                icon={<SavingsIcon />}
                                label={formatCost(card.insight.cost)}
                                variant="outlined"
                              />
                            )}
                          </>
                        )}
                        
                        <IconButton
                          size="small"
                          onClick={() => generateSingleInsight(card.id)}
                          disabled={card.loading}
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    
                    {card.loading && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          Generating insight...
                        </Typography>
                      </Box>
                    )}
                    
                    {card.error && (
                                          <Alert severity="error">
                      {card.error}
                    </Alert>
                    )}
                    
                    {card.insight && !card.loading && (
                      <Typography variant="body1">
                        {card.insight.insight}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* Chat Interface */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ChatIcon color="primary" />
            <Typography variant="h6">Ask Questions</Typography>
          </Box>
          
          {/* Chat Messages */}
          <Box
            sx={{
              height: 300,
              overflowY: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
              mb: 2,
              bgcolor: 'grey.50'
            }}
          >
            {chatMessages.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                Ask me anything about your business data! 
                <br />
                Try: "What are my biggest opportunities?" or "How can I reduce costs?"
              </Typography>
            )}
            
            {chatMessages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  mb: 1,
                  display: 'flex',
                  justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Paper
                  sx={{
                    p: 1.5,
                    maxWidth: '80%',
                    bgcolor: message.type === 'user' ? 'primary.main' : 'background.paper',
                    color: message.type === 'user' ? 'primary.contrastText' : 'text.primary'
                  }}
                >
                  <Typography variant="body2">
                    {message.content}
                  </Typography>
                  
                  {message.insight && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        icon={getSourceIcon(message.insight.source)}
                        label={message.insight.source}
                        variant="outlined"
                      />
                      {message.insight.cost > 0 && (
                        <Chip
                          size="small"
                          label={formatCost(message.insight.cost)}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  )}
                </Paper>
              </Box>
            ))}
            
            {chatLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Analyzing your question...
                </Typography>
              </Box>
            )}
            
            <div ref={chatEndRef} />
          </Box>
          
          {/* Chat Input */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              placeholder="Ask about your business performance..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!aggregatedData || chatLoading}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              onClick={handleChatSubmit}
              disabled={!chatInput.trim() || !aggregatedData || chatLoading}
              sx={{ minWidth: 80 }}
            >
              Ask
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default BusinessInsightsGenerator;
