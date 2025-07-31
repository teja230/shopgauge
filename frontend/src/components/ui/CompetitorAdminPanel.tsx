import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PlayArrow as PlayArrowIcon,
  BugReport as DebugIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import marketIntelligenceAdminAPI from '../../api/marketIntelligenceAdmin';
import type { 
  CompetitorScrapingStatus, 
  CompetitorTriggerResponse, 
  CacheDebugInfo,
  TriggerScrapingDebugInfo,
  ProductsDebugInfo
} from '../../api/marketIntelligenceAdmin';
import { useNotifications } from '../../hooks/useNotifications';
import { styled } from '@mui/material/styles';

// Styled components matching admin theme
const AdminCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  },
}));

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
}));

const AdminButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  padding: theme.spacing(1.5, 3),
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
}));

interface CompetitorAdminPanelProps {
  showActions?: boolean;
}

const CompetitorAdminPanel: React.FC<CompetitorAdminPanelProps> = ({
  showActions = true,
}) => {
  const { addNotification } = useNotifications();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<number | ''>('');
  const [availableShops, setAvailableShops] = useState<Array<{ id: number; shopify_domain: string }>>([]);
  const [scrapingStatus, setScrapingStatus] = useState<CompetitorScrapingStatus | null>(null);
  const [cacheDebugInfo, setCacheDebugInfo] = useState<CacheDebugInfo | null>(null);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<any>(null);
  const [triggerResult, setTriggerResult] = useState<CompetitorTriggerResponse | null>(null);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerDebugResult, setTriggerDebugResult] = useState<TriggerScrapingDebugInfo | null>(null);
  const [productsDebugInfo, setProductsDebugInfo] = useState<ProductsDebugInfo | null>(null);
  const [debugDialogOpen, setDebugDialogOpen] = useState(false);
  const [debugDialogType, setDebugDialogType] = useState<'trigger-debug' | 'products-debug' | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // Load available shops on component mount
  useEffect(() => {
    loadAvailableShops();
  }, []);

  // Load scraping status when shop is selected
  useEffect(() => {
    if (selectedShopId) {
      loadScrapingStatus(selectedShopId as number);
      loadCacheDebugInfo(selectedShopId as number);
    }
  }, [selectedShopId]);

  const loadAvailableShops = async () => {
    try {
      setLoading(true);
      const status = await marketIntelligenceAdminAPI.getCompetitorScrapingStatus();
      if (status.availableShops) {
        setAvailableShops(status.availableShops);
      }
    } catch (error) {
      addNotification('Failed to load available shops', 'error');
      console.error('Error loading available shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScrapingStatus = async (shopId: number) => {
    try {
      setLoading(true);
      const status = await marketIntelligenceAdminAPI.getCompetitorScrapingStatus(shopId);
      setScrapingStatus(status);
    } catch (error) {
      addNotification('Failed to load scraping status', 'error');
      console.error('Error loading scraping status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCacheDebugInfo = async (shopId: number) => {
    try {
      const cacheInfo = await marketIntelligenceAdminAPI.getCacheDebugInfo(shopId);
      setCacheDebugInfo(cacheInfo);
    } catch (error) {
      addNotification('Failed to load cache debug info', 'error');
      console.error('Error loading cache debug info:', error);
    }
  };

  const handleTriggerScraping = async () => {
    if (!selectedCompetitor) return;

    try {
      setTriggerLoading(true);
      const result = await marketIntelligenceAdminAPI.triggerCompetitorScraping(
        selectedCompetitor.id.toString(),
        selectedShopId as number
      );
      setTriggerResult(result);
      addNotification('Scraping triggered successfully', 'success');
      
      // Refresh scraping status after trigger
      if (selectedShopId) {
        await loadScrapingStatus(selectedShopId as number);
      }
    } catch (error) {
      addNotification('Failed to trigger scraping', 'error');
      console.error('Error triggering scraping:', error);
    } finally {
      setTriggerLoading(false);
    }
  };

  const handleTriggerScrapingDebug = async (competitorId: string) => {
    if (!selectedShopId) return;

    try {
      setDebugLoading(true);
      const result = await marketIntelligenceAdminAPI.triggerScrapingDebug(
        competitorId,
        selectedShopId as number
      );
      setTriggerDebugResult(result);
      setDebugDialogType('trigger-debug');
      setDebugDialogOpen(true);
      
      // Show debug information messages
      if (result.scrapingSuccess) {
        addNotification(`Debug: Latest price $${result.scrapedPrice} found via ${result.latestSnapshot?.scraper_source || 'unknown source'}`, 'info');
      } else if (result.failureReason === 'No price snapshots found') {
        addNotification('Debug: No price snapshots found for this competitor', 'warning');
      } else if (result.failureReason === 'No valid price found in latest snapshot') {
        addNotification('Debug: Latest snapshot shows no valid price', 'warning');
      } else {
        addNotification('Debug: Analysis complete - check dialog for details', 'info');
      }
    } catch (error) {
      addNotification('Failed to get debug information', 'error');
      console.error('Error getting debug information:', error);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleProductsDebug = async () => {
    if (!selectedShopId) return;

    try {
      setDebugLoading(true);
      const result = await marketIntelligenceAdminAPI.getProductsDebug(selectedShopId as number);
      setProductsDebugInfo(result);
      setDebugDialogType('products-debug');
      setDebugDialogOpen(true);
      addNotification('Products debug info loaded successfully', 'success');
    } catch (error) {
      addNotification('Failed to load products debug info', 'error');
      console.error('Error loading products debug info:', error);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string) => {
    if (!selectedShopId) return;

    try {
      setDebugLoading(true);
      // Call the delete API endpoint
      const response = await fetch(`/api/competitors/${competitorId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        addNotification('Competitor tracking has been discontinued successfully', 'success');
        // Refresh the scraping status to update the list
        await loadScrapingStatus(selectedShopId as number);
      } else {
        const errorData = await response.json();
        addNotification(`Unable to remove competitor tracking: ${errorData.error || 'Please try again'}`, 'error');
      }
    } catch (error) {
      addNotification('Failed to delete competitor', 'error');
      console.error('Error deleting competitor:', error);
    } finally {
      setDebugLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'error': return 'error';
      case 'BLOCKED_BY_ERRORS': return 'error';
      case 'DUE_FOR_SCRAPING': return 'warning';
      case 'RECENTLY_SCRAPED': return 'success';
      case 'NEVER_SCRAPED': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'RECENTLY_SCRAPED':
        return <CheckCircleIcon />;
      case 'error':
      case 'BLOCKED_BY_ERRORS':
        return <ErrorIcon />;
      case 'DUE_FOR_SCRAPING':
        return <WarningIcon />;
      case 'NEVER_SCRAPED':
        return <InfoIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatLastCheck = (competitor: any) => {
    // Use latest_price_check if last_successful_check is null but we have recent scraping
    if (!competitor.last_successful_check && competitor.latest_price_check) {
      return formatDate(competitor.latest_price_check);
    }
    return formatDate(competitor.last_successful_check);
  };

  const formatResponseTime = (ms: number | null) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', background: 'linear-gradient(135deg, #f1f5fb 0%, #ffffff 60%)' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" fontWeight="bold" sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2, 
          mb: 1,
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          <DebugIcon sx={{ fontSize: 40 }} />
        Competitor Admin Panel
      </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor and manage competitor scraping operations across all shops
        </Typography>
      </Box>

      {/* Shop Selection */}
      <AdminCard sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Shop Selection
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Shop</InputLabel>
            <Select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value as number)}
              label="Select Shop"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">
                <em>Select a shop to debug</em>
              </MenuItem>
              {availableShops.map((shop) => (
                <MenuItem key={shop.id} value={shop.id}>
                  {shop.shopify_domain} (ID: {shop.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </AdminCard>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {selectedShopId && scrapingStatus && (
        <>
          {/* Summary Statistics */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <AdminCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Scraping Summary
                  </Typography>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Total Competitors:</Typography>
                      <Typography variant="h4" fontWeight="bold" color="primary.main">
                        {scrapingStatus.summary.total_competitors}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Active Status:</Typography>
                      <Chip 
                        label={scrapingStatus.summary.active_status} 
                        color="success" 
                        size="small" 
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Error Status:</Typography>
                      <Chip 
                        label={scrapingStatus.summary.error_status} 
                        color="error" 
                        size="small" 
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Due for Scraping:</Typography>
                      <Chip 
                        label={scrapingStatus.summary.due_for_scraping} 
                        color="warning" 
                        size="small" 
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </AdminCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <AdminCard>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Platform Analytics
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries(scrapingStatus.summary.platform_stats).map(([platform, count]) => (
                      <Box key={platform} sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 1,
                        borderRadius: 1,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                          {platform}:
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                          {count}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </AdminCard>
            </Box>
          </Box>

          {/* Competitors Table */}
          <AdminCard sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Competitor Details ({scrapingStatus.competitors.length} competitors)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Scroll horizontally to see all columns
              </Typography>
              </Box>
              <TableContainer sx={{ borderRadius: 2, overflow: 'auto', maxWidth: '100%' }}>
                <Table sx={{ minWidth: 1200 }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'primary.main' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '60px' }}>ID</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '300px' }}>URL</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '120px' }}>Status</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '100px' }}>Platform</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '120px' }}>Scraper Source</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '120px' }}>Last Check</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '80px' }}>Price</TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 600, width: '100px' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scrapingStatus.competitors.map((competitor, index) => (
                      <TableRow 
                        key={competitor.id}
                        sx={{ 
                          backgroundColor: index % 2 === 0 ? 'background.paper' : 'action.hover',
                          '&:hover': { backgroundColor: 'action.selected' }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{competitor.id}</TableCell>
                        <TableCell>
                          <Tooltip title={competitor.url}>
                            <Typography variant="body2" sx={{ 
                              maxWidth: 280, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              color: 'primary.main',
                              fontWeight: 500,
                              whiteSpace: 'nowrap'
                            }}>
                              {competitor.url}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip title={`Error Count: ${competitor.error_count || 0} | Status: ${competitor.status || 'unknown'}`}>
                          <Chip
                            icon={getStatusIcon(competitor.scraping_status)}
                            label={competitor.scraping_status}
                            color={getStatusColor(competitor.scraping_status) as any}
                            size="small"
                              sx={{ fontWeight: 600 }}
                          />
                          </Tooltip>
                          {competitor.error_count > 0 && (
                            <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                              {competitor.error_count} error{competitor.error_count > 1 ? 's' : ''}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={competitor.platform || 'Unknown'} 
                            size="small" 
                            variant="outlined"
                            color={competitor.platform ? 'default' : 'warning'}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={competitor.scraper_source || 'Unknown'} 
                            size="small" 
                            variant="outlined"
                            color={competitor.scraper_source ? 'default' : 'warning'}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatLastCheck(competitor)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {competitor.price && competitor.price > 0 ? `$${competitor.price}` : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Trigger Scraping">
                            <IconButton
                              size="small"
                                sx={{ 
                                  color: 'primary.main',
                                  '&:hover': { 
                                    backgroundColor: 'primary.main',
                                    color: 'white'
                                  }
                                }}
                              onClick={() => {
                                setSelectedCompetitor(competitor);
                                setTriggerDialogOpen(true);
                              }}
                            >
                              <PlayArrowIcon />
                            </IconButton>
                          </Tooltip>
                            <Tooltip title="Debug Info">
                              <IconButton
                                size="small"
                                sx={{ 
                                  color: 'info.main',
                                  '&:hover': { 
                                    backgroundColor: 'info.main',
                                    color: 'white'
                                  }
                                }}
                                onClick={() => handleTriggerScrapingDebug(competitor.id.toString())}
                                disabled={debugLoading}
                              >
                                <DebugIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Competitor">
                              <IconButton
                                size="small"
                                sx={{ 
                                  color: 'error.main',
                                  '&:hover': { 
                                    backgroundColor: 'error.main',
                                    color: 'white'
                                  }
                                }}
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete competitor ID ${competitor.id}?`)) {
                                    handleDeleteCompetitor(competitor.id.toString());
                                  }
                                }}
                                disabled={debugLoading}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </AdminCard>

          {/* Cache Debug Info */}
          {cacheDebugInfo && (
            <AdminCard sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Cache Debug Information
                </Typography>
                  <AdminButton
                    variant="outlined"
                    size="small"
                    startIcon={<DebugIcon />}
                    onClick={handleProductsDebug}
                    disabled={debugLoading}
                    sx={{ 
                      color: 'warning.main',
                      borderColor: 'warning.main',
                      '&:hover': { 
                        backgroundColor: 'warning.main',
                        color: 'white'
                      }
                    }}
                  >
                    Products Debug
                  </AdminButton>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Redis Connected:</Typography>
                        <Chip 
                          icon={cacheDebugInfo.redisConnected ? <CheckCircleIcon /> : <ErrorIcon />}
                          label={cacheDebugInfo.redisConnected ? 'Connected' : 'Disconnected'}
                          color={cacheDebugInfo.redisConnected ? 'success' : 'error'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Cache Exists:</Typography>
                        <Chip 
                          icon={cacheDebugInfo.cacheExists ? <CheckCircleIcon /> : <ErrorIcon />}
                          label={cacheDebugInfo.cacheExists ? 'Yes' : 'No'}
                          color={cacheDebugInfo.cacheExists ? 'success' : 'error'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Database Products:</Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                          {cacheDebugInfo.databaseProductCount}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                      Cache Key: {cacheDebugInfo.cacheKey}
                    </Typography>
                    {cacheDebugInfo.redisError && (
                      <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
                        Redis Error: {cacheDebugInfo.redisError}
                      </Alert>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </AdminCard>
          )}
        </>
      )}

      {/* Trigger Scraping Dialog */}
      <Dialog 
        open={triggerDialogOpen} 
        onClose={() => setTriggerDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
          color: 'white',
          fontWeight: 600
        }}>
          Trigger Scraping for Competitor
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {selectedCompetitor && (
            <Stack spacing={3}>
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.main', mb: 1 }}>
                  Competitor Details
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                <strong>URL:</strong> {selectedCompetitor.url}
              </Typography>
                  <Typography variant="body2">
                <strong>Current Status:</strong> {selectedCompetitor.scraping_status}
              </Typography>
                  <Typography variant="body2">
                <strong>Last Check:</strong> {formatDate(selectedCompetitor.last_successful_check)}
              </Typography>
                </Stack>
              </Box>
              
              {triggerResult && (
                <Accordion sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'primary.dark' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Trigger Results
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: 'background.paper' }}>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Domain:</strong> {triggerResult.domain}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Recent Scrape Key:</strong> {triggerResult.recentScrapeKey}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Rate Limit Key:</strong> {triggerResult.rateLimitKey}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Recent Scrape Exists:</strong> {triggerResult.recentScrapeExists ? 'Yes' : 'No'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Rate Limit Exists:</strong> {triggerResult.rateLimitExists ? 'Yes' : 'No'}
                      </Typography>
                      {triggerResult.currentStatus && (
                        <Typography variant="body2">
                          <strong>Current Status:</strong> {triggerResult.currentStatus.status}
                        </Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <AdminButton 
            onClick={() => setTriggerDialogOpen(false)}
            variant="outlined"
          >
            Close
          </AdminButton>
          <AdminButton
            onClick={handleTriggerScraping}
            disabled={triggerLoading}
            variant="contained"
            startIcon={triggerLoading ? <CircularProgress size={16} /> : <PlayArrowIcon />}
          >
            {triggerLoading ? 'Triggering...' : 'Trigger Scraping'}
          </AdminButton>
        </DialogActions>
      </Dialog>

      {/* Debug Dialog */}
      <Dialog 
        open={debugDialogOpen} 
        onClose={() => setDebugDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #ff9800 0%, #ff5722 100%)',
          color: 'white',
          fontWeight: 600
        }}>
          {debugDialogType === 'trigger-debug' ? 'Competitor Debug Information' : 'Products Debug Information'}
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {debugDialogType === 'trigger-debug' && triggerDebugResult && (
            <Stack spacing={3}>
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'warning.main', mb: 1 }}>
                  Debug Information
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Competitor ID:</strong> {triggerDebugResult.competitorId}
                  </Typography>
                  <Typography variant="body2">
                    <strong>URL:</strong> {triggerDebugResult.url}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Domain:</strong> {triggerDebugResult.domain}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Recent Scrape Key:</strong> {triggerDebugResult.recentScrapeKey}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Rate Limit Key:</strong> {triggerDebugResult.rateLimitKey}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Recent Scrape Exists:</strong> {triggerDebugResult.recentScrapeExists ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Rate Limit Exists:</strong> {triggerDebugResult.rateLimitExists ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Scraping Triggered:</strong> {triggerDebugResult.scrapingTriggered ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Message:</strong> {triggerDebugResult.message}
                  </Typography>
                </Stack>
              </Box>
              
              {triggerDebugResult.currentStatus && (
                <Accordion sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      backgroundColor: 'warning.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'warning.dark' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Current Status
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: 'background.paper' }}>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Status:</strong> {triggerDebugResult.currentStatus.status}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Last Successful Check:</strong> {formatDate(triggerDebugResult.currentStatus.last_successful_check)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Error Count:</strong> {triggerDebugResult.currentStatus.error_count}
                      </Typography>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}

              {triggerDebugResult.priceSnapshots && triggerDebugResult.priceSnapshots.length > 0 && (
                <Accordion sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      backgroundColor: 'success.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'success.dark' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Price Snapshots
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: 'background.paper' }}>
                    <Stack spacing={1}>
                      {triggerDebugResult.priceSnapshots.map((snapshot, index) => (
                        <Box key={index} sx={{ p: 2, borderRadius: 2, backgroundColor: 'action.hover' }}>
                          <Typography variant="body2">
                            <strong>Price:</strong> ${snapshot.price}
                          </Typography>
                          <Typography variant="body2">
                            <strong>In Stock:</strong> {snapshot.in_stock ? 'Yes' : 'No'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Checked At:</strong> {formatDate(snapshot.checked_at)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Platform:</strong> {snapshot.platform}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Scraper Source:</strong> {snapshot.scraper_source}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          )}

          {debugDialogType === 'products-debug' && productsDebugInfo && (
            <Stack spacing={3}>
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'background.paper' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'warning.main', mb: 1 }}>
                  Products Debug Information
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    <strong>Shop ID:</strong> {productsDebugInfo.shopId}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Shop Domain:</strong> {productsDebugInfo.shopDomain}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Redis Connected:</strong> {productsDebugInfo.redisConnected ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Cache Key:</strong> {productsDebugInfo.cacheKey}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Cache Exists:</strong> {productsDebugInfo.cacheExists ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Cache TTL:</strong> {productsDebugInfo.cacheTtl || 'N/A'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Raw Cache Data Length:</strong> {productsDebugInfo.rawCacheDataLength}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Database Products Count:</strong> {productsDebugInfo.dbProductsCount}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Unified Products Approach:</strong> {productsDebugInfo.unifiedProductsApproach ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Products Endpoint:</strong> {productsDebugInfo.productsEndpoint}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Analytics Endpoint:</strong> {productsDebugInfo.analyticsEndpoint}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Demo Mode Supported:</strong> {productsDebugInfo.demoModeSupported ? 'Yes' : 'No'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Live Mode Uses Analytics:</strong> {productsDebugInfo.liveModeUsesAnalytics ? 'Yes' : 'No'}
                  </Typography>
                </Stack>
              </Box>

              {productsDebugInfo.redisError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  <strong>Redis Error:</strong> {productsDebugInfo.redisError}
                </Alert>
              )}

              {productsDebugInfo.parseError && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  <strong>Parse Error:</strong> {productsDebugInfo.parseError}
                </Alert>
              )}

              {productsDebugInfo.dbError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  <strong>Database Error:</strong> {productsDebugInfo.dbError}
                </Alert>
              )}

              {productsDebugInfo.parsedDataKeys && (
                <Accordion sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      backgroundColor: 'info.main',
                      color: 'white',
                      '&:hover': { backgroundColor: 'info.dark' }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Parsed Data Information
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ backgroundColor: 'background.paper' }}>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Parsed Data Keys:</strong> {productsDebugInfo.parsedDataKeys.join(', ')}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Parsed Data Type:</strong> {productsDebugInfo.parsedDataType}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Data Type:</strong> {productsDebugInfo.dataType}
                      </Typography>
                      {productsDebugInfo.dataKeys && (
                        <Typography variant="body2">
                          <strong>Data Keys:</strong> {productsDebugInfo.dataKeys.join(', ')}
                        </Typography>
                      )}
                      <Typography variant="body2">
                        <strong>Products Type:</strong> {productsDebugInfo.productsType}
                      </Typography>
                      {productsDebugInfo.productsListSize && (
                        <Typography variant="body2">
                          <strong>Products List Size:</strong> {productsDebugInfo.productsListSize}
                        </Typography>
                      )}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <AdminButton 
            onClick={() => setDebugDialogOpen(false)}
            variant="outlined"
          >
            Close
          </AdminButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CompetitorAdminPanel; 