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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
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
  sectionTitle?: string;
  sectionCount?: number;
  sectionColor?: 'green' | 'orange';
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
  onCompetitorRestored?: (competitorId?: string) => void;
  archivedLimit?: number;
  archivedCurrent?: number;
  refreshTrigger?: number; // Triggers refresh when value changes
  highlightedCompetitorId?: string | number; // External highlighting support
  highlightAction?: 'add' | 'archive' | 'restore'; // External highlighting support
}

// Styled components to match CompetitorTable
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  '@media (max-width: 600px)': {
    borderRadius: 12,
    margin: '0 -8px',
    '& .MuiTable-root': {
      minWidth: 'auto',
    },
  },
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

const StyledTableRow = styled(TableRow)<{ $highlighted?: boolean; $highlightColor?: 'success' | 'warning' }>(({ theme, $highlighted, $highlightColor }) => ({
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
  // Highlight styles
  ...($highlighted && {
    backgroundColor: $highlightColor === 'success' 
      ? 'rgba(34, 197, 94, 0.1)' // Green background for restore
      : 'rgba(245, 158, 11, 0.1)', // Orange background for archive/delete
    borderLeft: `4px solid ${
      $highlightColor === 'success' 
        ? theme.palette.success.main 
        : theme.palette.warning.main
    }`,
    '&:hover': {
      backgroundColor: $highlightColor === 'success' 
        ? 'rgba(34, 197, 94, 0.15)' 
        : 'rgba(245, 158, 11, 0.15)',
    },
  }),
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  padding: '16px',
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const ArchivedCompetitorsPanel: React.FC<ArchivedCompetitorsPanelProps> = ({ 
  shopId, 
  onCountChange,
  sectionTitle,
  sectionCount,
  sectionColor = 'orange',
  onToggleCollapse,
  isCollapsed = false,
  onCompetitorRestored,
  archivedLimit,
  archivedCurrent,
  refreshTrigger,
  highlightedCompetitorId,
  highlightAction,
}) => {
  const [deletedCompetitors, setDeletedCompetitors] = useState<ArchivedCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());
  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    competitor: ArchivedCompetitor | null;
    newLabel: string;
  }>({
    open: false,
    competitor: null,
    newLabel: ''
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

  // Function to highlight a row briefly
  const highlightRow = (competitorId: string | number, color: 'success' | 'warning') => {
    const competitorIdStr = String(competitorId);
    setHighlightedRows(prev => new Set([...prev, competitorIdStr]));
    
    // Remove highlight after 5 seconds (industry standard for UI feedback)
    setTimeout(() => {
      setHighlightedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(competitorIdStr);
        return newSet;
      });
    }, 5000);
  };

  useEffect(() => {
    loadDeletedCompetitors();
  }, [shopId]);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(deletedCompetitors.length);
    }
  }, [deletedCompetitors.length, onCountChange]);

  // Refresh archived competitors when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined) {
      loadDeletedCompetitors();
    }
  }, [refreshTrigger]);

  // Handle external highlighting from props
  useEffect(() => {
    if (highlightedCompetitorId && highlightAction) {
      // Determine color based on action
      let color: 'success' | 'warning';
      
      if (highlightAction === 'add') {
        color = 'success'; // Green for adding
      } else if (highlightAction === 'archive') {
        color = 'warning'; // Orange for archiving
      } else if (highlightAction === 'restore') {
        color = 'success'; // Green for restoring
      } else {
        color = 'success';
      }
      
      highlightRow(highlightedCompetitorId, color);
    }
  }, [highlightedCompetitorId, highlightAction]);

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
        
        // Highlight the row before removing it
        highlightRow(restoreDialog.competitor!.id, 'success');
        
        setDeletedCompetitors(prev => 
          prev.filter(c => c.id !== restoreDialog.competitor!.id)
        );
        notifications.showSuccess('Archived competitor restored successfully', {
          showToast: true
        });
        
        // Notify parent component to refresh active competitors
        if (onCompetitorRestored) {
          onCompetitorRestored(restoreDialog.competitor!.id);
        }
      } else {
        const response = await fetchWithAuth(`/api/competitors/${restoreDialog.competitor.id}/restore`, {
          method: 'POST',
          body: JSON.stringify({ label: restoreDialog.competitor.label })
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
          // Highlight the row before removing it
          highlightRow(restoreDialog.competitor!.id, 'success');
          
          setDeletedCompetitors(prev => 
            prev.filter(c => c.id !== restoreDialog.competitor!.id)
          );
          notifications.showSuccess('Archived competitor restored successfully', {
            showToast: true
          });
          
          // Notify parent component to refresh active competitors
          if (onCompetitorRestored) {
            onCompetitorRestored(restoreDialog.competitor!.id);
          }
        } else {
          // Handle error response
          throw new Error(data.error || data.message || 'Failed to restore competitor');
        }
      }
    } catch (error: any) {
      console.error('Error restoring competitor:', error);
      
      // Handle specific error messages
      let errorMessage = 'Failed to restore archived competitor';
      
      // Check for the specific error format from backend
      if (error.message?.includes('COMPETITOR_LIMIT_EXCEEDED') || error.message?.includes('competitor limit')) {
        errorMessage = 'You have reached the maximum competitor tracking limit for your current subscription tier.';
      } else if (error.message?.includes('ARCHIVED_COMPETITOR_LIMIT_EXCEEDED') || error.message?.includes('archived competitor limit')) {
        errorMessage = 'You have reached the maximum archived competitor limit for your current subscription tier.';
      } else if (error.message?.includes('limit')) {
        errorMessage = 'You have reached the maximum competitor tracking limit for your current subscription tier.';
      }
      
      notifications.showError(errorMessage, {
        showToast: true
      });
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
        
        // Highlight the row before removing it
        highlightRow(permanentDeleteDialog.competitorId!, 'warning');
        
        setDeletedCompetitors(prev => prev.filter(c => c.id !== permanentDeleteDialog.competitorId));
        notifications.showSuccess('Archived competitor permanently deleted', {
          showToast: true
        });
      } else {
        const response = await fetchWithAuth(`/api/competitors/${permanentDeleteDialog.competitorId}/permanent`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
          // Highlight the row before removing it
          highlightRow(permanentDeleteDialog.competitorId!, 'warning');
          
          setDeletedCompetitors(prev => prev.filter(c => c.id !== permanentDeleteDialog.competitorId));
          notifications.showSuccess('Archived competitor permanently deleted', {
            showToast: true
          });
        }
      }
    } catch (error) {
      console.error('Error permanently deleting competitor:', error);
      notifications.showError('Failed to permanently delete archived competitor', {
        showToast: true
      });
    } finally {
      setPermanentDeleteDialog({ open: false, competitorId: null, competitorLabel: '' });
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
      
      {/* Integrated Section Header */}
      {sectionTitle && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          cursor: onToggleCollapse ? 'pointer' : 'default',
          '&:hover': onToggleCollapse ? {
            backgroundColor: 'action.hover'
          } : {}
        }}
        onClick={onToggleCollapse}
      >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onToggleCollapse && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse();
                }}
                size="medium"
                sx={{ 
                  color: 'text.secondary',
                  minWidth: 44,
                  minHeight: 44,
                  '@media (max-width: 600px)': {
                    minWidth: 48,
                    minHeight: 48,
                  }
                }}
              >
                {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%',
                  backgroundColor: sectionColor === 'green' ? 'success.main' : 'warning.main'
                }} 
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {sectionTitle}
              </Typography>
              {sectionCount !== undefined && (
                <Chip
                  label={sectionCount}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    backgroundColor: 'grey.100',
                    color: 'text.secondary'
                  }}
                />
              )}
              {archivedLimit !== undefined && archivedCurrent !== undefined && (
                <Chip
                  label={`${archivedCurrent}/${archivedLimit}`}
                  size="small"
                  sx={{ 
                    height: 20, 
                    fontSize: '0.75rem',
                    backgroundColor: archivedCurrent >= archivedLimit * 0.8 ? 'warning.light' : 'success.light',
                    color: archivedCurrent >= archivedLimit * 0.8 ? 'warning.dark' : 'success.dark',
                    fontWeight: 600
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      )}
      
      {/* Content Section */}
      {!isCollapsed && (
        <>
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
                    <StyledTableRow 
                      key={competitor.id}
                      $highlighted={highlightedRows.has(competitor.id)}
                      $highlightColor={highlightedRows.has(competitor.id) ? 'success' : undefined}
                    >
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
        </>
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
    </Box>
  );
}; 