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
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useNotifications } from '../../context/NotificationSettingsContext';
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
      <Typography variant="h6" gutterBottom>
        Deleted Competitors ({deletedCompetitors.length})
      </Typography>

      {deletedCompetitors.length === 0 ? (
        <Alert severity="info">
          No deleted competitors found. All deleted competitors will appear here for 30 days.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>URL</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Deleted</TableCell>
                <TableCell>Last Check</TableCell>
                <TableCell>Price History</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deletedCompetitors.map((competitor) => (
                <TableRow key={competitor.id}>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {competitor.url}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={competitor.label || 'No Label'} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={competitor.platform || 'Unknown'} 
                      size="small" 
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(competitor.deleted_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
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
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Tooltip title="View Price History">
                        <IconButton
                          size="small"
                          onClick={() => handleViewHistory(competitor.id)}
                          disabled={competitor.price_snapshots_count === 0}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Restore Competitor">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleRestore(competitor)}
                          disabled={restoring === competitor.id}
                        >
                          {restoring === competitor.id ? <CircularProgress size={16} /> : <RestoreIcon />}
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Permanently Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handlePermanentDelete(competitor.id)}
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
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialog.open} onClose={() => setRestoreDialog({ open: false, competitor: null, newLabel: '' })}>
        <DialogTitle>Restore Competitor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Restore this competitor to active tracking. You can update the label if needed.
          </Typography>
          <TextField
            fullWidth
            label="Competitor Label"
            value={restoreDialog.newLabel}
            onChange={(e) => setRestoreDialog(prev => ({ ...prev, newLabel: e.target.value }))}
            margin="normal"
            placeholder="Enter a label for this competitor"
          />
          {restoreDialog.competitor && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>URL:</strong> {restoreDialog.competitor.url}
            </Typography>
          )}
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
          {viewHistoryDialog.history.length === 0 ? (
            <Alert severity="info">No price history available for this competitor.</Alert>
          ) : (
            <TableContainer component={Paper} sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Change</TableCell>
                    <TableCell>Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewHistoryDialog.history.map((snapshot: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        {formatDate(snapshot.checked_at)}
                      </TableCell>
                      <TableCell>
                        ${snapshot.price?.toFixed(2) || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={snapshot.in_stock ? 'In Stock' : 'Out of Stock'}
                          size="small"
                          color={snapshot.in_stock ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell>
                        {snapshot.price_change_percent ? (
                          <Chip 
                            label={`${snapshot.price_change_percent > 0 ? '+' : ''}${snapshot.price_change_percent.toFixed(1)}%`}
                            size="small"
                            color={snapshot.price_change_percent > 0 ? 'success' : 'error'}
                          />
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={snapshot.scraper_source || 'Unknown'}
                          size="small"
                          variant="outlined"
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
          <Button onClick={() => setViewHistoryDialog({ open: false, competitorId: null, history: [] })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}; 