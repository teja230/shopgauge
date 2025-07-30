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
  Grid,
  Stack
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  OpenInNew as OpenInNewIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import { fetchWithAuth } from '../../api';
import StoreLogo from './StoreLogo';

interface ArchivedCompetitor {
  id: string;
  url: string;
  label: string;
  deleted_at: string;
  platform: string;
  domain: string;
  last_successful_check: string | null;
  price_snapshots_count: number;
}

interface ArchivedCompetitorsPanelProps {
  shopId: string;
  onCountChange?: (count: number) => void;
}

// Styled components to match CompetitorTable
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: '#f9fafb',
  '& .MuiTableCell-head': {
    color: '#374151',
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '16px',
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(even)': {
    backgroundColor: '#f9fafb',
  },
  '&:hover': {
    backgroundColor: '#f3f4f6',
  },
  transition: 'background-color 0.2s ease',
  '&:last-child .MuiTableCell-root': {
    borderBottom: 0,
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  padding: '16px',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const DeletedCompetitorsPanel: React.FC<ArchivedCompetitorsPanelProps> = ({ shopId, onCountChange }) => {
  const [deletedCompetitors, setDeletedCompetitors] = useState<ArchivedCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    competitor: ArchivedCompetitor | null;
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

  const [permanentDeleteDialog, setPermanentDeleteDialog] = useState<{
    open: boolean;
    competitorId: string | null;
    competitorLabel: string;
  }>({
    open: false,
    competitorId: null,
    competitorLabel: ''
  });

  const notifications = useNotifications();

  useEffect(() => {
    loadDeletedCompetitors();
  }, [shopId]);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(deletedCompetitors.length);
    }
  }, [deletedCompetitors.length, onCountChange]);

  const loadDeletedCompetitors = async () => {
    try {
      setLoading(true);
      
      // Demo mode - simulate deleted competitors
      if (shopId === 'demo') {
        const demoDeletedCompetitors: ArchivedCompetitor[] = [
          {
            id: '1',
            url: 'https://amazon.com/dp/B0FK2RZ4T9',
            label: 'Amazon Product B0FK2RZ4T9',
            deleted_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 15 hours ago
            platform: 'amazon',
            domain: 'amazon.com',
            last_successful_check: null,
            price_snapshots_count: 0
          },
          {
            id: '2',
            url: 'https://amazon.com/dp/B0CCFPN9QN',
            label: 'Reef Mens Raglan Sandal Fossil',
            deleted_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
            platform: 'amazon',
            domain: 'amazon.com',
            last_successful_check: null,
            price_snapshots_count: 0
          },
          {
            id: '3',
            url: 'https://amazon.com/dp/B0CCFPN9QN',
            label: 'Amazon Product B0CCFPN9QN',
            deleted_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // 15 hours ago
            platform: 'amazon',
            domain: 'amazon.com',
            last_successful_check: null,
            price_snapshots_count: 0
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

  const handleRestore = async (competitor: ArchivedCompetitor) => {
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
        notifications.showSuccess('Archived competitor restored successfully');
      } else {
        const response = await fetchWithAuth(`/api/competitors/${restoreDialog.competitor.id}/restore`, {
          method: 'POST',
          body: JSON.stringify({ label: restoreDialog.competitor.label })
        });
        
        const data = await response.json();
        if (data.success) {
          setDeletedCompetitors(prev => 
            prev.filter(c => c.id !== restoreDialog.competitor!.id)
          );
          notifications.showSuccess('Archived competitor restored successfully');
        }
      }
    } catch (error) {
      console.error('Error restoring competitor:', error);
      notifications.showError('Failed to restore archived competitor');
    } finally {
      setRestoring(null);
      setRestoreDialog({ open: false, competitor: null, newLabel: '' });
    }
  };

  const handlePermanentDelete = async (competitor: ArchivedCompetitor) => {
    setPermanentDeleteDialog({
      open: true,
      competitorId: competitor.id,
      competitorLabel: competitor.label || 'Unnamed Competitor'
    });
  };

  const confirmPermanentDelete = async () => {
    if (!permanentDeleteDialog.competitorId) return;

    try {
      if (shopId === 'demo') {
        // Demo mode - simulate permanent delete
        await new Promise(resolve => setTimeout(resolve, 500));
        setDeletedCompetitors(prev => prev.filter(c => c.id !== permanentDeleteDialog.competitorId));
        notifications.showSuccess('Archived competitor permanently deleted');
      } else {
        const response = await fetchWithAuth(`/api/competitors/${permanentDeleteDialog.competitorId}/permanent`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
          setDeletedCompetitors(prev => prev.filter(c => c.id !== permanentDeleteDialog.competitorId));
          notifications.showSuccess('Archived competitor permanently deleted');
        }
      }
    } catch (error) {
      console.error('Error permanently deleting competitor:', error);
      notifications.showError('Failed to permanently delete archived competitor');
    } finally {
      setPermanentDeleteDialog({ open: false, competitorId: null, competitorLabel: '' });
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
    <Box>
      {/* Demo Mode Indicator */}
      {shopId === 'demo' && (
        <Box sx={{ 
          mb: 2, 
          p: 2, 
          backgroundColor: '#fef3c7', 
          border: '1px solid #f59e0b',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Box sx={{ 
            p: 0.5, 
            borderRadius: 1, 
            backgroundColor: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>
              DEMO
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#92400e', fontSize: '0.875rem' }}>
            Showing sample deleted competitors data
          </Typography>
        </Box>
      )}
      
      {/* Content Section */}
      {deletedCompetitors.length === 0 ? (
        /* Empty State */
        <Box sx={{ 
          py: 3, 
          px: 3,
          textAlign: 'center',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            No archived competitors. All archived competitors will appear here for 30 days.
          </Typography>
        </Box>
      ) : (
        /* Table - Matches CompetitorTable styling exactly */
        <StyledTableContainer>
          <Table>
            <StyledTableHead>
              <TableRow>
                <TableCell>
                                      <span>Competitor</span>
                </TableCell>
                <TableCell>Archived</TableCell>
                <TableCell>Last Check</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </StyledTableHead>
            <TableBody>
              {deletedCompetitors.map((competitor) => (
                <StyledTableRow key={competitor.id}>
                  <StyledTableCell>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <StoreLogo url={competitor.url} size={32} />
                      <Box>
                        <Typography variant="body2" fontWeight="600" color="text.primary">
                          {competitor.label || 'Unnamed Competitor'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {competitor.domain || getDomainFromUrl(competitor.url)}
                        </Typography>
                      </Box>
                    </Stack>
                  </StyledTableCell>
                  <StyledTableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(competitor.deleted_at)}
                    </Typography>
                  </StyledTableCell>
                  <StyledTableCell>
                    <Typography variant="body2" color="text.secondary">
                      {competitor.last_successful_check 
                        ? formatDate(competitor.last_successful_check)
                        : 'Never'
                      }
                    </Typography>
                  </StyledTableCell>
                  <StyledTableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Visit competitor website">
                        <IconButton
                          size="small"
                          onClick={() => window.open(competitor.url, '_blank')}
                          sx={{ minWidth: 36, minHeight: 36 }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restore competitor">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleRestore(competitor)}
                          disabled={restoring === competitor.id}
                          sx={{ minWidth: 36, minHeight: 36 }}
                        >
                          {restoring === competitor.id ? <CircularProgress size={16} /> : <RestoreIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View price history">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleViewHistory(competitor.id)}
                          disabled={competitor.price_snapshots_count === 0}
                          sx={{ 
                            minWidth: 36, 
                            minHeight: 36,
                            opacity: competitor.price_snapshots_count > 0 ? 1 : 0.4,
                            '&:disabled': {
                              opacity: 0.4,
                              cursor: 'not-allowed'
                            }
                          }}
                        >
                          <BarChartIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Permanently delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handlePermanentDelete(competitor)}
                          sx={{ minWidth: 36, minHeight: 36 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </StyledTableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}

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

      {/* Permanent Delete Confirmation Dialog */}
      <Dialog open={permanentDeleteDialog.open} onClose={() => setPermanentDeleteDialog({ open: false, competitorId: null, competitorLabel: '' })}>
        <DialogTitle sx={{ color: '#dc2626', fontWeight: 600 }}>
          Permanently Delete Archived Competitor
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to permanently delete "{permanentDeleteDialog.competitorLabel}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ 
            backgroundColor: '#fef2f2', 
            border: '1px solid #fecaca', 
            borderRadius: 1, 
            p: 2,
            color: '#dc2626'
          }}>
            ⚠️ This action cannot be undone. The archived competitor and all associated price history will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setPermanentDeleteDialog({ open: false, competitorId: null, competitorLabel: '' })}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmPermanentDelete} 
            variant="contained" 
            color="error"
            sx={{ 
              backgroundColor: '#dc2626',
              '&:hover': {
                backgroundColor: '#b91c1c'
              }
            }}
          >
            Permanently Delete
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