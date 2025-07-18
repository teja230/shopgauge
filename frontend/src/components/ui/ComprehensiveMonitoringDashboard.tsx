import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Badge,
  Stack
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Computer as ComputerIcon,
  Storage as DatabaseIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { fetchWithAdminAuth } from '../../api';
import RefreshHeader from './RefreshHeader';

interface MonitoringData {
  dashboards?: any;
  alerts?: any;
  systemResources?: any;
  applicationMetrics?: any;
  timestamp?: string;
}

interface AlertData {
  alertId: string;
  severity: string;
  message: string;
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  acknowledged: boolean;
}

const ComprehensiveMonitoringDashboard: React.FC = () => {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AlertData | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const fetchMonitoringData = async () => {
    try {
      setError(null);
      setLoading(true);
      // Correct endpoint from AdminController
      const data = await fetchWithAdminAuth('/api/admin/monitoring/dashboard');
      setMonitoringData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    if (refreshCooldown > 0) return;
    setRefreshCooldown(180); // 3 minutes cooldown
    await fetchMonitoringData();
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetchWithAdminAuth(`/api/admin/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      
      // Refresh monitoring data to update alert status
      await fetchMonitoringData();
      setAlertDialogOpen(false);
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  // Cooldown timer for refresh
  useEffect(() => {
    if (refreshCooldown > 0) {
      const timer = setTimeout(() => setRefreshCooldown(refreshCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [refreshCooldown]);

  // Load data only on component mount when there is no data
  useEffect(() => {
    // Only fetch data if we don't have any data yet
    if (!monitoringData) {
      fetchMonitoringData();
    }
  }, []); // Empty dependency array - only run on mount

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      case 'info': return <InfoIcon />;
      default: return <CheckCircleIcon />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number) => {
    if (!value || isNaN(value)) return '0%';
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading monitoring data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6">Error loading monitoring data</Typography>
        <Typography>{error}</Typography>
        <Button onClick={fetchMonitoringData} startIcon={<RefreshIcon />} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!monitoringData) {
    return (
      <Alert severity="info">
        No monitoring data available
      </Alert>
    );
  }

  // Safely extract data with fallbacks
  const alerts = monitoringData.alerts || {};
  const systemResources = monitoringData.systemResources || {};
  const applicationMetrics = monitoringData.applicationMetrics || {};
  
  const activeAlerts = alerts?.alertDetails ? Object.entries(alerts.alertDetails) : [];
  const criticalAlerts = activeAlerts.filter(([_, alert]: [string, any]) => 
    alert?.severity === 'CRITICAL'
  );
  const warningAlerts = activeAlerts.filter(([_, alert]: [string, any]) => 
    alert?.severity === 'WARNING'
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Comprehensive Monitoring Dashboard
        </Typography>
        <RefreshHeader
          lastUpdated={lastRefresh ? (() => {
            const diff = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
            if (diff < 60) return 'Just now';
            if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
            return lastRefresh.toLocaleString();
          })() : 'Never'}
          onRefresh={refreshData}
          loading={loading}
          cooldown={refreshCooldown > 0}
          cooldownRemaining={refreshCooldown}
          label="Refresh"
          tooltip="Refresh monitoring dashboard data"
        />
      </Box>

      {/* Alert Summary */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={3}>
        <Box flex="1" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={alerts?.activeCriticalAlerts || 0} color="error">
                  <ErrorIcon color="error" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">{alerts?.activeCriticalAlerts || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">Critical Alerts</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={alerts?.activeWarningAlerts || 0} color="warning">
                  <WarningIcon color="warning" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">{alerts?.activeWarningAlerts || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">Warning Alerts</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <NotificationsIcon color="primary" />
                <Box ml={2}>
                  <Typography variant="h6">{alerts?.totalAlertsGenerated || 0}</Typography>
                  <Typography variant="body2" color="textSecondary">Total Alerts</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="250px">
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircleIcon color="success" />
                <Box ml={2}>
                  <Typography variant="h6">
                    {(alerts?.activeAlerts || 0) === 0 ? 'Healthy' : 'Issues'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">System Status</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* System Resources */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={3}>
        <Box flex="1" minWidth="300px">
          <Card>
            <CardHeader 
              title="Memory Usage" 
              avatar={<MemoryIcon />}
            />
            <CardContent>
              {systemResources?.memory ? (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.memory.usagePercent || 0}
                    color={(systemResources.memory.usagePercent || 0) > 80 ? 'error' : 'primary'}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2">
                    {formatPercentage(systemResources.memory.usagePercent || 0)} 
                    ({formatBytes((systemResources.memory.usedMemoryMB || 0) * 1024 * 1024)} / 
                     {formatBytes((systemResources.memory.maxMemoryMB || 0) * 1024 * 1024)})
                  </Typography>
                  <Chip 
                    label={systemResources.memory.alert || 'Normal'} 
                    color={systemResources.memory.alert === 'CRITICAL' ? 'error' : 
                           systemResources.memory.alert === 'WARNING' ? 'warning' : 'success'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Memory data not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="300px">
          <Card>
            <CardHeader 
              title="CPU Usage" 
              avatar={<SpeedIcon />}
            />
            <CardContent>
              {systemResources?.cpu ? (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.cpu.processCpuLoad || 0}
                    color={(systemResources.cpu.processCpuLoad || 0) > 80 ? 'error' : 'primary'}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2">
                    {formatPercentage(systemResources.cpu.processCpuLoad || 0)}
                  </Typography>
                  <Chip 
                    label={systemResources.cpu.alert || 'Normal'} 
                    color={systemResources.cpu.alert === 'CRITICAL' ? 'error' : 
                           systemResources.cpu.alert === 'WARNING' ? 'warning' : 'success'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  CPU data not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="300px">
          <Card>
            <CardHeader 
              title="Disk Usage" 
              avatar={<StorageIcon />}
            />
            <CardContent>
              {systemResources?.disk ? (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.disk.usagePercent || 0}
                    color={(systemResources.disk.usagePercent || 0) > 80 ? 'error' : 'primary'}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="body2">
                    {formatPercentage(systemResources.disk.usagePercent || 0)} 
                    ({systemResources.disk.usedSpaceGB || 0}GB / {systemResources.disk.totalSpaceGB || 0}GB)
                  </Typography>
                  <Chip 
                    label={systemResources.disk.alert || 'Normal'} 
                    color={systemResources.disk.alert === 'CRITICAL' ? 'error' : 
                           systemResources.disk.alert === 'WARNING' ? 'warning' : 'success'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Disk data not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Application Metrics */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={3}>
        <Box flex="1" minWidth="400px">
          <Card>
            <CardHeader 
              title="Session Management" 
              avatar={<SecurityIcon />}
            />
            <CardContent>
              {applicationMetrics?.session ? (
                <Box display="flex" flexWrap="wrap" gap={2}>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Lock Acquisitions</Typography>
                    <Typography variant="h6">{applicationMetrics.session.lockAcquisitions || 0}</Typography>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Lock Failures</Typography>
                    <Typography variant="h6">{applicationMetrics.session.lockFailures || 0}</Typography>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Active Sessions</Typography>
                    <Typography variant="h6">{applicationMetrics.session.activeSessions || 0}</Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Session metrics not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
        <Box flex="1" minWidth="400px">
          <Card>
            <CardHeader 
              title="Database Performance" 
              avatar={<DatabaseIcon />}
            />
            <CardContent>
              {applicationMetrics?.database ? (
                <Box display="flex" flexWrap="wrap" gap={2}>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Active Connections</Typography>
                    <Typography variant="h6">{applicationMetrics.database.activeConnections || 0}</Typography>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Query Response Time</Typography>
                    <Typography variant="h6">{applicationMetrics.database.avgQueryTime || 0}ms</Typography>
                  </Box>
                  <Box flex="1" minWidth="150px">
                    <Typography variant="body2" color="textSecondary">Connection Pool Usage</Typography>
                    <Typography variant="h6">{formatPercentage(applicationMetrics.database.poolUsage || 0)}</Typography>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Database metrics not available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Active Alerts Table */}
      {activeAlerts.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardHeader 
            title="Active Alerts" 
            avatar={<NotificationsActiveIcon />}
          />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>First Occurrence</TableCell>
                    <TableCell>Last Occurrence</TableCell>
                    <TableCell>Count</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeAlerts.map(([alertId, alert]: [string, any]) => (
                    <TableRow key={alertId}>
                      <TableCell>
                        <Chip 
                          icon={getSeverityIcon(alert?.severity || 'info')}
                          label={alert?.severity || 'Unknown'}
                          color={getSeverityColor(alert?.severity || 'info')}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{alert?.message || 'No message'}</TableCell>
                      <TableCell>{alert?.firstOccurrence || 'Unknown'}</TableCell>
                      <TableCell>{alert?.lastOccurrence || 'Unknown'}</TableCell>
                      <TableCell>{alert?.occurrenceCount || 0}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedAlert({
                              alertId,
                              severity: alert?.severity || 'info',
                              message: alert?.message || 'No message',
                              firstOccurrence: alert?.firstOccurrence || 'Unknown',
                              lastOccurrence: alert?.lastOccurrence || 'Unknown',
                              occurrenceCount: alert?.occurrenceCount || 0,
                              acknowledged: alert?.acknowledged || false
                            });
                            setAlertDialogOpen(true);
                          }}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Alert Details Dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Alert Details
        </DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedAlert.message}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Severity: {selectedAlert.severity}
              </Typography>
              <Typography variant="body2" gutterBottom>
                First Occurrence: {selectedAlert.firstOccurrence}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Last Occurrence: {selectedAlert.lastOccurrence}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Occurrence Count: {selectedAlert.occurrenceCount}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Close</Button>
          {selectedAlert && !selectedAlert.acknowledged && (
            <Button 
              onClick={() => acknowledgeAlert(selectedAlert.alertId)}
              variant="contained"
              color="primary"
            >
              Acknowledge
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComprehensiveMonitoringDashboard;