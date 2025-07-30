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
  TrendingUp as TrendingUpIcon,
  OpenInNew as OpenInNewIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchWithAuth } from '../../api';
import StoreLogo from './StoreLogo';

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
            deleted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            platform: 'walmart',
            domain: 'walmart.com',
            last_successful_check: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            price_snapshots_count: 8
          }
        ];
        setDeletedCompetitors(demoDeletedCompetitors);
      } else {
        const response = await fetchWithAuth(`/api/competitors/deleted`);
        const data = await response.json();
        if (data.competitors) {
          setDeletedCompetitors(data.competitors || []);
        } else {
          console.error('Unexpected response format:', data);
          notifications.showError('Failed to load deleted competitors - unexpected response format');
        }
      }
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
      
      if (shopId === 'demo') {
        // Demo mode - simulate restore
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDeletedCompetitors(prev => 
          prev.filter(c => c.id !== restoreDialog.competitor!.id)
        );
        notifications.showSuccess('Competitor restored successfully');
      } else {
        const response = await fetchWithAuth(`/api/competitors/${restoreDialog.competitor.id}/restore`, {
          method: 'POST',
          body: JSON.stringify({})
        });
        
        const data = await response.json();
        if (data.success) {
          setDeletedCompetitors(prev => 
            prev.filter(c => c.id !== restoreDialog.competitor!.id)
          );
          notifications.showSuccess('Competitor restored successfully');
        }
      }
    } catch (error) {
      console.error('Error restoring competitor:', error);
      notifications.showError('Failed to restore competitor');
    } finally {
      setRestoring(null);
      setRestoreDialog({ open: false, competitor: null, newLabel: '' });
    }
  };

  const handlePermanentDelete = async (competitorId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this competitor? This action cannot be undone.')) {
      return;
    }

    try {
      if (shopId === 'demo') {
        // Demo mode - simulate permanent delete
        await new Promise(resolve => setTimeout(resolve, 500));
        setDeletedCompetitors(prev => prev.filter(c => c.id !== competitorId));
        notifications.showSuccess('Competitor permanently deleted');
      } else {
        const response = await fetchWithAuth(`/api/competitors/${competitorId}/permanent`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
          setDeletedCompetitors(prev => prev.filter(c => c.id !== competitorId));
          notifications.showSuccess('Competitor permanently deleted');
        }
      }
    } catch (error) {
      console.error('Error permanently deleting competitor:', error);
      notifications.showError('Failed to permanently delete competitor');
    }
  };

  const handleViewHistory = async (competitorId: string) => {
    try {
      if (shopId === 'demo') {
        // Demo mode - simulate price history
        const demoHistory = [
          { date: '2024-01-15', price: 199.99, change: 0 },
          { date: '2024-01-14', price: 189.99, change: -5.0 },
          { date: '2024-01-13', price: 199.99, change: 5.3 },
          { date: '2024-01-12', price: 189.99, change: -5.0 },
          { date: '2024-01-11', price: 199.99, change: 5.3 }
        ];
        setViewHistoryDialog({
          open: true,
          competitorId,
          history: demoHistory
        });
      } else {
        const response = await fetchWithAuth(`/api/competitors/${competitorId}/price-history?days=30`);
        const data = await response.json();
        
        if (data.success) {
          setViewHistoryDialog({
            open: true,
            competitorId,
            history: data.history || []
          });
        }
      }
    } catch (error) {
      console.error('Error loading price history:', error);
      notifications.showError('Failed to load price history');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const getDomainFromUrl = (url: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain;
    } catch {
      return 'unknown';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Full Width Design - Matches Main Table */}
      <Box sx={{ 
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
        width: '100%'
      }}>
        {/* Compact Header */}
        <Box sx={{ 
          px: 3, 
          py: 2.5, 
          backgroundColor: '#f9fafb',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Box sx={{ 
            p: 0.5, 
            borderRadius: 1.5, 
            backgroundColor: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ArchiveIcon sx={{ fontSize: 18, color: '#6b7280' }} />
          </Box>
          <Box flex={1}>
            <Typography variant="subtitle2" fontWeight="600" color="text.primary">
              Deleted Competitors
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Manage and restore deleted competitors
            </Typography>
          </Box>
          <Chip 
            label={`${deletedCompetitors.length} deleted`}
            size="small"
            sx={{ 
              backgroundColor: deletedCompetitors.length > 0 ? '#fef3c7' : '#f3f4f6',
              color: deletedCompetitors.length > 0 ? '#92400e' : '#6b7280',
              fontWeight: 500,
              fontSize: '0.75rem',
              height: 20
            }}
          />
        </Box>

        {/* Content Section */}
        {deletedCompetitors.length === 0 ? (
          /* Consistent Empty State */
          <Box sx={{ 
            py: 3, 
            px: 3,
            textAlign: 'center',
            backgroundColor: 'white'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
              No deleted competitors. All deleted competitors will appear here for 30 days.
            </Typography>
          </Box>
                    ) : (
            /* Deleted Competitors Table - Integrated Design */
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '16px',
                      borderBottom: '2px solid #e5e7eb'
                    }}>Competitor</TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '16px',
                      borderBottom: '2px solid #e5e7eb'
                    }}>Deleted</TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '16px',
                      borderBottom: '2px solid #e5e7eb'
                    }}>Last Check</TableCell>
                    <TableCell sx={{ 
                      color: '#374151', 
                      fontWeight: 600, 
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '16px',
                      borderBottom: '2px solid #e5e7eb'
                    }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deletedCompetitors.map((competitor, index) => (
                    <TableRow 
                      key={competitor.id} 
                      sx={{ 
                        backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                        '&:hover': { backgroundColor: '#f3f4f6' },
                        transition: 'background-color 0.2s ease',
                        '&:last-child .MuiTableCell-root': {
                          borderBottom: 0,
                        },
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, padding: '16px' }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <StoreLogo url={competitor.url} size={24} />
                          <Box>
                            <Typography variant="body2" fontWeight="500" color="text.primary">
                              {competitor.label || 'Unnamed Competitor'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {competitor.domain || getDomainFromUrl(competitor.url)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, padding: '16px' }}>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(competitor.deleted_at)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, padding: '16px' }}>
                        <Typography variant="body2" color="text.secondary">
                          {competitor.last_successful_check 
                            ? formatDate(competitor.last_successful_check)
                            : 'Never'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, padding: '16px' }}>
                        <Box display="flex" gap={1}>
                          <Tooltip title="Open URL">
                            <IconButton
                              size="small"
                              onClick={() => window.open(competitor.url, '_blank')}
                              sx={{ 
                                color: '#6b7280',
                                '&:hover': { backgroundColor: '#f3f4f6' }
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Restore competitor">
                            <IconButton
                              size="small"
                              onClick={() => handleRestore(competitor)}
                              disabled={restoring === competitor.id}
                              sx={{ 
                                color: '#059669',
                                '&:hover': { backgroundColor: '#ecfdf5' },
                                '&.Mui-disabled': { color: '#9ca3af' }
                              }}
                            >
                              {restoring === competitor.id ? <CircularProgress size={16} /> : <RestoreIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View price history">
                            <IconButton
                              size="small"
                              onClick={() => handleViewHistory(competitor.id)}
                              disabled={competitor.price_snapshots_count === 0}
                              sx={{ 
                                color: '#2563eb',
                                '&:hover': { backgroundColor: '#eff6ff' },
                                '&.Mui-disabled': { color: '#9ca3af' }
                              }}
                            >
                              <BarChartIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Permanently delete">
                            <IconButton
                              size="small"
                              onClick={() => handlePermanentDelete(competitor.id)}
                              sx={{ 
                                color: '#dc2626',
                                '&:hover': { backgroundColor: '#fef2f2' }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialog.open} onClose={() => setRestoreDialog({ open: false, competitor: null, newLabel: '' })}>
        <DialogTitle>Restore Competitor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to restore "{restoreDialog.competitor?.label || 'Unnamed Competitor'}"?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This will restore the competitor with its full price history and resume price monitoring.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog({ open: false, competitor: null, newLabel: '' })}>
            Cancel
          </Button>
          <Button 
            onClick={confirmRestore} 
            variant="contained" 
            color="primary"
            disabled={restoring !== null}
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
      >
        <DialogTitle>Price History</DialogTitle>
        <DialogContent>
          {viewHistoryDialog.history.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewHistoryDialog.history.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell>{entry.date}</TableCell>
                      <TableCell>${entry.price}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${entry.change > 0 ? '+' : ''}${entry.change}%`}
                          size="small"
                          sx={{ 
                            backgroundColor: entry.change > 0 ? '#dcfce7' : entry.change < 0 ? '#fee2e2' : '#f3f4f6',
                            color: entry.change > 0 ? '#166534' : entry.change < 0 ? '#dc2626' : '#374151'
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No price history available for this competitor.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewHistoryDialog({ open: false, competitorId: null, history: [] })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 