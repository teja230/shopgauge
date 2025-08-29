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
  const { isAuthenticated, shop } = useAuth();
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Insight cards
  const [insightCards, setInsightCards] = useState<InsightCard[]>([
    { 
      id: 'summary', 
      type: 'summary', 
      title: 'Executive Summary', 
      description: 'Key performance metrics and business overview',
      icon: AnalyticsIcon,
      color: theme.palette.primary.main,
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
      color: theme.palette.success.main,
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
      color: theme.palette.warning.main,
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
      color: theme.palette.info.main,
      insight: null, 
      loading: false, 
      error: null 
    }
  ]);

  // Suggested questions
  const suggestedQuestions: SuggestedQuestion[] = [
    { 
      text: "What are my top performing products this week?", 
      icon: TrendingUpIcon,
      category: "Performance"
    },
    { 
      text: "How do I compare to my competitors?", 
      icon: AnalyticsIcon,
      category: "Competition"
    },
    { 
      text: "What should I focus on to increase revenue?", 
      icon: CostIcon,
      category: "Revenue"
    },
    { 
      text: "Which products have the best profit margins?", 
      icon: RecommendationIcon,
      category: "Profitability"
    },
    { 
      text: "What marketing strategies should I prioritize?", 
      icon: AIIcon,
      category: "Strategy"
    },
    { 
      text: "How can I optimize my inventory levels?", 
      icon: AnalyticsIcon,
      category: "Operations"
    }
  ];

  // Load data on component mount
  useEffect(() => {
    if (shop && isAuthenticated) {
      loadAggregatedData();
    }
  }, [shop, isAuthenticated]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingMessage]);

  const loadAggregatedData = useCallback(async (forceRefresh = true) => {
    if (!shop || !isAuthenticated) return;
    
    setDataLoading(true);
    setDataError(null);
    
    try {
      console.log('🔄 Loading shop data for ShopGPT:', shop);
      const data = await dataAggregationService.aggregateShopData(shop, forceRefresh);
      setAggregatedData(data);
      
      // Auto-generate insights on initial load
      if (forceRefresh) {
        await generateAllInsights(data);
      }
    } catch (error) {
      console.error('Failed to load aggregated data:', error);
      setDataError('Failed to load business data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [shop, isAuthenticated]);

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
              timeframe: '7d',
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
      const request: InsightRequest = {
        type: 'summary',
        data: aggregatedData,
        context: {
          timeframe: '7d',
          focus: ['chat']
        }
      };
      
      const insight = await aiInsightsService.generateInsight(request);
      
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
      console.error('Chat insight generation failed:', error);
      setChatLoading(false);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your question. Please try again.',
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
        py: { xs: 2, md: 4 }
      }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              ShopGPT
            </Typography>
            <Typography variant="body1" color="text.secondary">
              AI-powered business insights for {shop}
            </Typography>
          </Box>

          {/* Loading State */}
          {dataLoading && (
            <Box sx={{ mb: 3 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ 
                textAlign: 'center', 
                mt: 2, 
                color: 'text.secondary'
              }}>
                Loading shop data...
              </Typography>
            </Box>
          )}
          
          {/* Error State */}
          {dataError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {dataError}
            </Alert>
          )}

          {/* ChatGPT-style Interface */}
          {aggregatedData && (
            <Box>
              {/* Chat Container */}
              <Card sx={{ 
                mb: 4,
                minHeight: 400,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Chat Header */}
                <Box sx={{ 
                  p: 2, 
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'grey.50'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ 
                      bgcolor: 'primary.main',
                      width: 32,
                      height: 32
                    }}>
                      <BotIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="h6" fontWeight={600}>
                      ShopGPT Assistant
                    </Typography>
                  </Box>
                </Box>
                
                {/* Chat Messages Area */}
                <Box sx={{ 
                  flexGrow: 1,
                  p: 3,
                  overflowY: 'auto',
                  minHeight: 300
                }}>
                  {/* Welcome Message */}
                  {chatMessages.length === 0 && (
                    <Fade in>
                      <Box>
                        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                          <Avatar sx={{ 
                            bgcolor: 'primary.main',
                            width: 32,
                            height: 32
                          }}>
                            <BotIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Paper sx={{ 
                              p: 2,
                              bgcolor: 'grey.50',
                              borderRadius: 2
                            }}>
                              <Typography variant="body1" sx={{ mb: 2 }}>
                                Hello! I'm your AI business analyst. I can help you understand your shop's performance, 
                                analyze trends, and provide strategic recommendations. What would you like to know?
                              </Typography>
                              
                              {/* Initial Suggested Questions - Consistent Style */}
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                Here are some questions you can ask:
                              </Typography>
                              <Box sx={{ 
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1
                              }}>
                                {suggestedQuestions.map((q, idx) => (
                                  <Chip
                                    key={idx}
                                    label={q.text}
                                    size="small"
                                    onClick={() => handleSuggestedQuestion(q.text)}
                                    sx={{ 
                                      '& .MuiChip-label': {
                                        fontSize: '0.75rem'
                                      },
                                      cursor: 'pointer',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      bgcolor: 'background.paper',
                                      '&:hover': {
                                        bgcolor: 'primary.50',
                                        borderColor: 'primary.main'
                                      }
                                    }}
                                  />
                                ))}
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
                          bgcolor: message.type === 'user' ? 'primary.main' : 'secondary.main',
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
                            p: 2,
                            bgcolor: message.type === 'user' ? 'primary.50' : 'grey.50',
                            borderRadius: 2
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
                          p: 2,
                          bgcolor: 'grey.50',
                          borderRadius: 2
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
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                          Continue the conversation:
                        </Typography>
                        <Box sx={{ 
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 1
                        }}>
                          {suggestedQuestions.slice(0, 4).map((q, idx) => (
                            <Chip
                              key={`followup-${idx}`}
                              label={q.text}
                              size="small"
                              onClick={() => handleSuggestedQuestion(q.text)}
                              sx={{ 
                                '& .MuiChip-label': {
                                  fontSize: '0.75rem'
                                },
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                '&:hover': {
                                  bgcolor: 'primary.50',
                                  borderColor: 'primary.main'
                                }
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </Fade>
                  )}
                  
                  <div ref={chatEndRef} />
                </Box>
                
                {/* Chat Input */}
                <Box sx={{ 
                  p: 2, 
                  borderTop: 1,
                  borderColor: 'divider'
                }}>
                  <TextField
                    fullWidth
                    placeholder="Ask me anything about your business..."
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
                          <AIIcon sx={{ color: 'primary.main' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => handleChatSubmit()}
                            disabled={!chatInput.trim() || chatLoading}
                            sx={{
                              color: 'primary.main',
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
                        '& fieldset': {
                          borderColor: 'divider'
                        },
                        '&:hover fieldset': {
                          borderColor: 'primary.main'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main'
                        }
                      }
                    }}
                  />
                </Box>
              </Card>

              {/* Insight Cards - Below Chat */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
                  AI-Generated Insights
                </Typography>
                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: '1fr 1fr', 
                    lg: 'repeat(4, 1fr)' 
                  }, 
                  gap: 2 
                }}>
                  {insightCards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                      <Card key={card.id} sx={{ 
                        height: '100%',
                        position: 'relative',
                        '&:hover': {
                          boxShadow: 2
                        }
                      }}>
                        <CardContent>
                          {/* Card Header */}
                          <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start', 
                            mb: 2 
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ color: card.color }}>
                                <IconComponent />
                              </Box>
                              <Box>
                                <Typography variant="subtitle1" sx={{ 
                                  fontWeight: 600,
                                  lineHeight: 1.2
                                }}>
                                  {card.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {card.description}
                                </Typography>
                              </Box>
                            </Box>
                            
                            <IconButton
                              size="small"
                              onClick={() => generateSingleInsight(card.id)}
                              disabled={card.loading}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          
                          {/* Content */}
                          <Box sx={{ minHeight: 100 }}>
                            {card.loading && (
                              <Box>
                                <Skeleton variant="text" />
                                <Skeleton variant="text" />
                                <Skeleton variant="text" width="60%" />
                              </Box>
                            )}
                            
                            {card.error && (
                              <Alert severity="error" sx={{ py: 0.5, px: 1 }}>
                                <Typography variant="caption">
                                  {card.error}
                                </Typography>
                              </Alert>
                            )}
                            
                            {card.insight && !card.loading && (
                              <Typography variant="body2" color="text.secondary">
                                {card.insight.insight}
                              </Typography>
                            )}
                            
                            {!card.insight && !card.loading && !card.error && (
                              <Box sx={{ 
                                textAlign: 'center', 
                                py: 3,
                                color: 'text.disabled'
                              }}>
                                <AIIcon sx={{ fontSize: 24, opacity: 0.3, mb: 1 }} />
                                <Typography variant="caption">
                                  Generating insights...
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