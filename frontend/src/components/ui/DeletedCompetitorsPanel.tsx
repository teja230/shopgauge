import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  Divider,
  Grid
} from '@mui/material';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  Archive as ArchiveIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../api';

interface DeletedCompetitor {
  id: string;
  url: string;
  label: string;
  deleted_at: string;
  platform: string;
  domain: string;
  last_successful_check: string;
  price_snapshots_count: number;
}

interface DeletedCompetitorsPanelProps {
  shopId: string;
}

export const DeletedCompetitorsPanel: React.FC<DeletedCompetitorsPanelProps> = ({ shopId }) => {
  const [deletedCompetitors, setDeletedCompetitors] = useState<DeletedCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    competitor: DeletedCompetitor | null;
    newLabel: string;
  }>({
    open: false,
    competitor: null,
    newLabel: ''
  });
  const [viewHistoryDialog, setViewHistoryDialog] = useState<{
    open: boolean;
    competitorId: string | null;
    history: any[];
  }>({
    open: false,
    competitorId: null,
    history: []
  });

  const notifications = useNotifications();

  useEffect(() => {
    loadDeletedCompetitors();
  }, [shopId]);

  const loadDeletedCompetitors = async () => {
    try {
      setLoading(true);
      
      // Demo mode - simulate deleted competitors
      if (shopId === 'demo') {
        const demoDeletedCompetitors: DeletedCompetitor[] = [
          {
            id: '1',
            url: 'https://amazon.com/demo-product-1',
            label: 'Demo Competitor 1',
            deleted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            platform: 'amazon',
            domain: 'amazon.com',
            last_successful_check: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            price_snapshots_count: 15
          },
          {
            id: '2',
            url: 'https://walmart.com/demo-product-2',
            label: 'Demo Competitor 2',
            deleted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
            platform: 'walmart',
            domain: 'walmart.com',
            last_successful_check: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
            price_snapshots_count: 8
          },
          {
            id: '3',
            url: 'https://target.com/demo-product-3',
            label: 'Demo Competitor 3',
            deleted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            platform: 'target',
            domain: 'target.com',
            last_successful_check: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            price_snapshots_count: 0
          }
        ];
        
        setDeletedCompetitors(demoDeletedCompetitors);
        return;
      }
      
      const response = await api.get(`/competitors/deleted`);
      setDeletedCompetitors(response.data.competitors || []);
    } catch (error) {
      console.error('Error loading deleted competitors:', error);
      notifications.showError('Failed to load deleted competitors');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (competitor: DeletedCompetitor) => {
    setRestoreDialog({
      open: true,
      competitor,
      newLabel: competitor.label || ''
    });
  };

  const confirmRestore = async () => {
    if (!restoreDialog.competitor) return;

    try {
      setRestoring(restoreDialog.competitor.id);
      
      // Demo mode - simulate restore
      if (shopId === 'demo') {
        setTimeout(() => {
          notifications.showSuccess('Demo: Competitor restored successfully!');
          setRestoreDialog({ open: false, competitor: null, newLabel: '' });
          loadDeletedCompetitors(); // Refresh the list
          setRestoring(null);
        }, 1000);
        return;
      }
      
      const response = await api.post(`/competitors/${restoreDialog.competitor.id}/restore`, {
        label: restoreDialog.newLabel
      });

      if (response.data.success) {
        notifications.showSuccess('Competitor restored successfully!');
        setRestoreDialog({ open: false, competitor: null, newLabel: '' });
        loadDeletedCompetitors(); // Refresh the list
      } else {
        notifications.showError(response.data.error || 'Failed to restore competitor');
      }
    } catch (error: any) {
      console.error('Error restoring competitor:', error);
      notifications.showError(error.response?.data?.error || 'Failed to restore competitor');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (competitorId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this competitor? This action cannot be undone.')) {
      return;
    }

    try {
      // Demo mode - simulate permanent delete
      if (shopId === 'demo') {
        setTimeout(() => {
          notifications.showSuccess('Demo: Competitor permanently deleted');
          loadDeletedCompetitors(); // Refresh the list
        }, 1000);
        return;
      }
      
      const response = await api.delete(`/competitors/${competitorId}/permanent`);
      
      if (response.data.success) {
        notifications.showSuccess('Competitor permanently deleted');
        loadDeletedCompetitors(); // Refresh the list
      } else {
        notifications.showError(response.data.error || 'Failed to delete competitor');
      }
    } catch (error: any) {
      console.error('Error permanently deleting competitor:', error);
      notifications.showError(error.response?.data?.error || 'Failed to delete competitor');
    }
  };

  const handleViewHistory = async (competitorId: string) => {
    try {
      // Demo mode - simulate price history
      if (shopId === 'demo') {
        const demoHistory = [
          {
            price: 29.99,
            in_stock: true,
            checked_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            price_change_percent: 5.2,
            significant_change: true,
            platform: 'amazon',
            scraper_source: 'direct'
          },
          {
            price: 31.99,
            in_stock: true,
            checked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            price_change_percent: -2.1,
            significant_change: true,
            platform: 'amazon',
            scraper_source: 'scrapingdog'
          },
          {
            price: 32.99,
            in_stock: false,
            checked_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            price_change_percent: 3.1,
            significant_change: true,
            platform: 'amazon',
            scraper_source: 'serper'
          },
          {
            price: 31.99,
            in_stock: true,
            checked_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            price_change_percent: 0,
            significant_change: false,
            platform: 'amazon',
            scraper_source: 'direct'
          }
        ];
        
        setViewHistoryDialog({
          open: true,
          competitorId,
          history: demoHistory
        });
        return;
      }
      
      const response = await api.get(`/competitors/${competitorId}/price-history?days=90`);
      
      setViewHistoryDialog({
        open: true,
        competitorId,
        history: response.data.priceHistory || []
      });
    } catch (error) {
      console.error('Error loading price history:', error);
      notifications.showError('Failed to load price history');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Card sx={{ 
        mb: 3, 
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', 
        color: 'white',
        border: '1px solid #475569',
        borderRadius: 2
      }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <ArchiveIcon sx={{ fontSize: 32, color: '#94a3b8' }} />
            <Box>
              <Typography variant="h5" fontWeight="bold" sx={{ color: '#f1f5f9' }}>
                Deleted Competitors
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8, color: '#cbd5e1' }}>
                Manage and restore deleted competitors with full price history
              </Typography>
            </Box>
            <Chip 
              label={`${deletedCompetitors.length} deleted`}
              sx={{ 
                ml: 'auto',
                backgroundColor: 'rgba(148, 163, 184, 0.2)',
                color: '#f1f5f9',
                fontWeight: 'bold',
                border: '1px solid #475569'
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {deletedCompetitors.length === 0 ? (
        <Card sx={{ 
          background: 'linear-gradient(135deg, #475569 0%, #64748b 100%)', 
          color: 'white',
          border: '1px solid #64748b',
          borderRadius: 2
        }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <ArchiveIcon sx={{ fontSize: 24, color: '#94a3b8' }} />
              <Typography variant="h6" sx={{ color: '#f1f5f9' }}>
                No Deleted Competitors
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.8, color: '#cbd5e1' }}>
              All deleted competitors will appear here for 30 days with full price history preserved.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>URL</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Label</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Platform</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Deleted</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Last Check</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Price History</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deletedCompetitors.map((competitor) => (
                    <TableRow key={competitor.id} sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' } }}>
                      <TableCell sx={{ color: 'white' }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {competitor.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={competitor.label || 'No Label'} 
                          size="small" 
                          sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={competitor.platform || 'Unknown'} 
                          size="small" 
                          sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.3)',
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'white' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {formatDate(competitor.deleted_at)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'white' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                          {competitor.last_successful_check 
                            ? formatDate(competitor.last_successful_check)
                            : 'Never'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${competitor.price_snapshots_count} snapshots`}
                          size="small"
                          icon={<HistoryIcon />}
                          sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            '& .MuiChip-icon': { color: 'white' }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="View Price History">
                            <IconButton
                              size="small"
                              onClick={() => handleViewHistory(competitor.id)}
                              disabled={competitor.price_snapshots_count === 0}
                              sx={{ 
                                color: 'white',
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                                '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' }
                              }}
                            >
                              <TrendingUpIcon />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Restore Competitor">
                            <IconButton
                              size="small"
                              onClick={() => handleRestore(competitor)}
                              disabled={restoring === competitor.id}
                              sx={{ 
                                color: 'white',
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                                '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' }
                              }}
                            >
                              {restoring === competitor.id ? <CircularProgress size={16} /> : <RestoreIcon />}
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Permanently Delete">
                            <IconButton
                              size="small"
                              onClick={() => handlePermanentDelete(competitor.id)}
                              sx={{ 
                                color: '#ff6b6b',
                                '&:hover': { backgroundColor: 'rgba(255,107,107,0.1)' }
                              }}
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
        </Card>
      )}

      {/* Restore Dialog */}
      <Dialog 
        open={restoreDialog.open} 
        onClose={() => setRestoreDialog({ open: false, competitor: null, newLabel: '' })}
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', fontWeight: 'bold' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <RestoreIcon />
            Restore Competitor
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'white', opacity: 0.9, mb: 2 }}>
            Restore this competitor to active tracking. You can update the label if needed.
          </Typography>
          <TextField
            fullWidth
            label="Competitor Label"
            value={restoreDialog.newLabel}
            onChange={(e) => setRestoreDialog(prev => ({ ...prev, newLabel: e.target.value }))}
            margin="normal"
            placeholder="Enter a label for this competitor"
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                '&.Mui-focused fieldset': { borderColor: 'white' }
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
              '& .MuiInputBase-input': { color: 'white' }
            }}
          />
          {restoreDialog.competitor && (
            <Typography variant="body2" sx={{ mt: 2, color: 'white', opacity: 0.8 }}>
              <strong>URL:</strong> {restoreDialog.competitor.url}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRestoreDialog({ open: false, competitor: null, newLabel: '' })}
            sx={{ color: 'white' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmRestore} 
            variant="contained"
            disabled={restoring !== null}
            sx={{ 
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              '&:hover': { background: 'rgba(255,255,255,0.3)' }
            }}
          >
            {restoring ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Price History Dialog */}
      <Dialog 
        open={viewHistoryDialog.open} 
        onClose={() => setViewHistoryDialog({ open: false, competitorId: null, history: [] })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white'
          }
        }}
      >
        <DialogTitle sx={{ color: 'white', fontWeight: 'bold' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <TrendingUpIcon />
            Price History (90 Days)
          </Box>
        </DialogTitle>
        <DialogContent>
          {viewHistoryDialog.history.length === 0 ? (
            <Card sx={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: 'white' }}>
                  No Price History Available
                </Typography>
                <Typography variant="body2" sx={{ color: 'white', opacity: 0.8 }}>
                  This competitor has no price history data available for display.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Price</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Stock</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Change</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewHistoryDialog.history.map((snapshot: any, index: number) => (
                    <TableRow key={index} sx={{ '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' } }}>
                      <TableCell sx={{ color: 'white' }}>
                        {formatDate(snapshot.checked_at)}
                      </TableCell>
                      <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>
                        ${snapshot.price?.toFixed(2) || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={snapshot.in_stock ? 'In Stock' : 'Out of Stock'}
                          size="small"
                          sx={{ 
                            backgroundColor: snapshot.in_stock ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)',
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {snapshot.price_change_percent ? (
                          <Chip 
                            label={`${snapshot.price_change_percent > 0 ? '+' : ''}${snapshot.price_change_percent.toFixed(1)}%`}
                            size="small"
                            sx={{ 
                              backgroundColor: snapshot.price_change_percent > 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)',
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          />
                        ) : (
                          <Typography sx={{ color: 'white', opacity: 0.7 }}>N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={snapshot.scraper_source || 'Unknown'}
                          size="small"
                          sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setViewHistoryDialog({ open: false, competitorId: null, history: [] })}
            sx={{ color: 'white' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 