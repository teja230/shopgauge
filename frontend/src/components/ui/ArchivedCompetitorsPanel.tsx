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
  Stack,
  Collapse,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { styled } from '@mui/material/styles';
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  History as HistoryIcon,
  TrendingUp as TrendingUpIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  latest_snapshot_at?: string | null;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [deletedCompetitors, setDeletedCompetitors] = useState<ArchivedCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Map<string, 'success' | 'warning'>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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
  const sessionKey = React.useMemo(() => `mi_archived_${shopId}`, [shopId]);

  const seedFromSession = React.useCallback(() => {
    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setDeletedCompetitors(arr);
        }
      }
    } catch (_) {
      // ignore session parse errors
    }
  }, [sessionKey]);

  // Function to highlight a row briefly, with color persistence
  const highlightRow = (competitorId: string | number, color: 'success' | 'warning') => {
    const competitorIdStr = String(competitorId);
    setHighlightedRows(prev => {
      const next = new Map(prev);
      next.set(competitorIdStr, color);
      return next;
    });

    // Remove highlight after 5 seconds (industry standard for UI feedback)
    setTimeout(() => {
      setHighlightedRows(prev => {
        const next = new Map(prev);
        next.delete(competitorIdStr);
        return next;
      });
    }, 5000);
  };

  useEffect(() => {
    // L1: seed from session immediately
    seedFromSession();
    // L2/L3: fetch and write-through to session
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
      // Seed from session first, then fetch
      seedFromSession();
      loadDeletedCompetitors();
    }
  }, [refreshTrigger, seedFromSession]);

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

  // If external highlight id arrives before data, apply highlight when data loads
  useEffect(() => {
    if (highlightedCompetitorId && deletedCompetitors.some(c => String(c.id) === String(highlightedCompetitorId))) {
      const color: 'success' | 'warning' = highlightAction === 'archive' ? 'warning' : 'success';
      highlightRow(highlightedCompetitorId, color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedCompetitors.length, highlightedCompetitorId]);

  const toggleExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
          const list = data.competitors || [];
          setDeletedCompetitors(list);
          // L1: write-through to session
          try {
            sessionStorage.setItem(sessionKey, JSON.stringify(list));
          } catch (_) {
            // ignore quota errors
          }
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
          
          // Delay removal slightly so highlight is visible
          setTimeout(() => {
            setDeletedCompetitors(prev => 
              prev.filter(c => c.id !== restoreDialog.competitor!.id)
            );
            // L1: update session cache
            try {
              const raw = sessionStorage.getItem(sessionKey);
              if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                  const next = arr.filter((c: any) => String(c.id) !== String(restoreDialog.competitor!.id));
                  sessionStorage.setItem(sessionKey, JSON.stringify(next));
                }
              }
            } catch (_) {
              // ignore session errors
            }
          }, 250);
          // Update header counts if provided by backend
          if (typeof data.activeCount === 'number' && typeof data.archivedCount === 'number' && onCountChange) {
            onCountChange(data.archivedCount);
          }
          notifications.showSuccess('Archived competitor restored successfully', {
            showToast: true
          });
          
          // Notify parent component to refresh active competitors after delay
          if (onCompetitorRestored) {
            setTimeout(() => onCompetitorRestored(restoreDialog.competitor!.id), 250);
          }
        } else {
          // Handle error response
          // If backend provided counts in error, reflect archived count for UX consistency
          if (typeof data?.activeCount === 'number' && typeof data?.archivedCount === 'number' && onCountChange) {
            onCountChange(data.archivedCount);
          }
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
          '@media (max-width: 600px)': {
            p: 2.5,
            minHeight: 56
          }
        }} className="archived-competitors-panel">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onToggleCollapse && (
              <IconButton
                onClick={onToggleCollapse}
                size="small"
                sx={{ 
                  color: 'text.secondary',
                  minWidth: 44,
                  minHeight: 44,
                  '&:hover': {
                    color: 'text.primary'
                  },
                  '@media (max-width: 600px)': {
                    minWidth: 48,
                    minHeight: 48,
                  }
                }}
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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
            /* Mobile cards or desktop table */
            isMobile ? (
              <Box sx={{ p: 2 }}>
                <Stack spacing={2}>
                  {deletedCompetitors.map((c) => (
                    <Card key={c.id} onClick={() => toggleExpanded(c.id)} sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <StoreLogo url={c.url} size={40} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} noWrap>
                              {c.label || 'Unnamed Competitor'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {c.domain || getDomainFromUrl(c.url)}
                            </Typography>
                          </Box>
                          <IconButton size="small" aria-label="expand">
                            <ExpandMoreIcon sx={{ transform: expandedRows.has(c.id) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                          </IconButton>
                        </Stack>
                        <Collapse in={expandedRows.has(c.id)} timeout={200}>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Archived</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{formatDate(c.deleted_at)}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Last Check</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            {c.last_successful_check ? formatDate(c.last_successful_check) : c.latest_snapshot_at ? formatDate(c.latest_snapshot_at) : '-'}
                          </Typography>
                          {/* Mobile: Icon-only buttons matching desktop theme */}
                          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                            <Tooltip title="Visit Site">
                              <IconButton
                                size="medium"
                                onClick={(e) => { e.stopPropagation(); window.open(c.url, '_blank'); }}
                                color="primary"
                                aria-label="Visit competitor website"
                              >
                                <OpenInNewIcon />
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Restore">
                              <IconButton
                                size="medium"
                                onClick={(e) => { e.stopPropagation(); handleRestore(c); }}
                                disabled={restoring === c.id}
                                color="success"
                                aria-label="Restore competitor"
                                className="archived-restore-button"
                              >
                                {restoring === c.id ? <CircularProgress size={20} /> : <RestoreIcon />}
                              </IconButton>
                            </Tooltip>
                            
                            <Tooltip title="Delete Permanently">
                              <IconButton
                                size="medium"
                                onClick={(e) => { e.stopPropagation(); handlePermanentDelete(c); }}
                                color="error"
                                aria-label="Permanently delete"
                                className="archived-delete-button"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Collapse>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
            ) : (
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
                  {deletedCompetitors.map((competitor) => {
                    const idStr = String(competitor.id);
                    const isHighlighted = highlightedRows.has(idStr);
                    const rowColor = isHighlighted ? highlightedRows.get(idStr) : undefined;
                    return (
                    <StyledTableRow 
                      key={competitor.id}
                      $highlighted={isHighlighted}
                      $highlightColor={rowColor}
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
                            : competitor.latest_snapshot_at
                              ? formatDate(competitor.latest_snapshot_at)
                              : '-'}
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
                              className="archived-restore-button"
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
                              className="archived-delete-button"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </StyledTableCell>
                    </StyledTableRow>
                  );})}
                </TableBody>
              </Table>
            </StyledTableContainer>
            )
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