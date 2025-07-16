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

interface MonitoringData {
  dashboards: any;
  alerts: any;
  systemResources: any;
  applicationMetrics: any;
  timestamp: string;
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
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMonitoringData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/monitoring/dashboard');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch monitoring data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setMonitoringData(data);
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Refresh monitoring data to update alert status
        await fetchMonitoringData();
        setAlertDialogOpen(false);
      } else {
        throw new Error('Failed to acknowledge alert');
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    
    // Set up auto-refresh if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      case 'info': return <InfoIcon />;
      default: return <CheckCircleIcon />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatPercentage = (value: number) => {
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

  const { alerts, systemResources, applicationMetrics } = monitoringData;
  const activeAlerts = alerts?.alertDetails ? Object.entries(alerts.alertDetails) : [];
  const criticalAlerts = activeAlerts.filter(([_, alert]: [string, any]) => alert.severity === 'CRITICAL');
  const warningAlerts = activeAlerts.filter(([_, alert]: [string, any]) => alert.severity === 'WARNING');

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Comprehensive Monitoring Dashboard
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchMonitoringData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant={autoRefresh ? "contained" : "outlined"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto Refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
        </Stack>
      </Box>

      {/* Alert Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={3}>
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
        </Grid>
        <Grid item xs={12} md={3}>
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
        </Grid>
        <Grid item xs={12} md={3}>
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
        </Grid>
        <Grid item xs={12} md={3}>
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
        </Grid>
      </Grid>

      {/* System Resources */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader 
              title="Memory Usage" 
              avatar={<MemoryIcon />}
            />
            <CardContent>
              {systemResources?.memory && (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.memory.usagePercent || 0}
                    color={systemResources.memory.usagePercent > 80 ? 'error' : 'primary'}
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
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader 
              title="CPU Usage" 
              avatar={<SpeedIcon />}
            />
            <CardContent>
              {systemResources?.cpu && (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.cpu.processCpuLoad || 0}
                    color={systemResources.cpu.processCpuLoad > 80 ? 'error' : 'primary'}
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
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader 
              title="Disk Usage" 
              avatar={<StorageIcon />}
            />
            <CardContent>
              {systemResources?.disk && (
                <>
                  <LinearProgress 
                    variant="determinate" 
                    value={systemResources.disk.usagePercent || 0}
                    color={systemResources.disk.usagePercent > 80 ? 'error' : 'primary'}
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
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Application Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Session Management" 
              avatar={<SecurityIcon />}
            />
            <CardContent>
              {applicationMetrics?.session && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Lock Acquisitions</Typography>
                    <Typography variant="h6">{applicationMetrics.session.lockAcquisitions || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Lock Failures</Typography>
                    <Typography variant="h6">{applicationMetrics.session.lockFailures || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Active Locks</Typography>
                    <Typography variant="h6">{applicationMetrics.session.activeLocks || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Stuck Sessions</Typography>
                    <Typography variant="h6">{applicationMetrics.session.stuckSessionsCleared || 0}</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="SSE Performance" 
              avatar={<CloudIcon />}
            />
            <CardContent>
              {applicationMetrics?.sse && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Active Connections</Typography>
                    <Typography variant="h6">{applicationMetrics.sse.activeConnections || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Total Connections</Typography>
                    <Typography variant="h6">{applicationMetrics.sse.connectionsCreated || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Events Published</Typography>
                    <Typography variant="h6">{applicationMetrics.sse.eventsPublished || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Connection Errors</Typography>
                    <Typography variant="h6">{applicationMetrics.sse.connectionErrors || 0}</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Database and Cache Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Database Performance" 
              avatar={<DatabaseIcon />}
            />
            <CardContent>
              {applicationMetrics?.database && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Total Queries</Typography>
                    <Typography variant="h6">{applicationMetrics.database.queries || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Error Rate</Typography>
                    <Typography variant="h6">{formatPercentage(applicationMetrics.database.errorRate || 0)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Avg Query Duration</Typography>
                    <Typography variant="h6">{(applicationMetrics.database.averageQueryDuration || 0).toFixed(2)}ms</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Pool Exhaustion</Typography>
                    <Typography variant="h6">{applicationMetrics.database.connectionPoolExhaustion || 0}</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title="Cache Performance" 
              avatar={<AssessmentIcon />}
            />
            <CardContent>
              {applicationMetrics?.cache && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Hit Rate</Typography>
                    <Typography variant="h6">{formatPercentage(applicationMetrics.cache.hitRate || 0)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Cache Size</Typography>
                    <Typography variant="h6">{applicationMetrics.cache.currentSize || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Cache Hits</Typography>
                    <Typography variant="h6">{applicationMetrics.cache.hits || 0}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Evictions</Typography>
                    <Typography variant="h6">{applicationMetrics.cache.evictions || 0}</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* System Resilience Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader 
              title="System Resilience & Circuit Breakers" 
              avatar={<SecurityIcon />}
            />
            <CardContent>
              {monitoringData.dashboards?.resilienceMetrics && (() => {
                const latestMetrics = monitoringData.dashboards.resilienceMetrics[monitoringData.dashboards.resilienceMetrics.length - 1];
                return (
                  <Grid container spacing={3}>
                    {/* Overall Resilience Score */}
                    <Grid item xs={12} md={3}>
                      <Box textAlign="center">
                        <Typography variant="body2" color="textSecondary">Resilience Score</Typography>
                        <Box position="relative" display="inline-flex" mt={1}>
                          <CircularProgress
                            variant="determinate"
                            value={latestMetrics?.resilienceScore || 0}
                            size={80}
                            thickness={4}
                            color={
                              (latestMetrics?.resilienceScore || 0) >= 90 ? 'success' :
                              (latestMetrics?.resilienceScore || 0) >= 70 ? 'warning' : 'error'
                            }
                          />
                          <Box
                            position="absolute"
                            top={0}
                            left={0}
                            bottom={0}
                            right={0}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Typography variant="h6" component="div" color="textSecondary">
                              {Math.round(latestMetrics?.resilienceScore || 0)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Redis Circuit Breaker */}
                    <Grid item xs={12} md={9}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="h6" gutterBottom>
                            Redis Circuit Breaker
                            <Chip 
                              label={latestMetrics?.redisCircuitBreakerState || 'UNKNOWN'}
                              color={
                                latestMetrics?.redisCircuitBreakerState === 'CLOSED' ? 'success' :
                                latestMetrics?.redisCircuitBreakerState === 'HALF_OPEN' ? 'warning' : 'error'
                              }
                              size="small"
                              sx={{ ml: 2 }}
                            />
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Health Status</Typography>
                          <Typography variant="h6">
                            {latestMetrics?.redisHealthy ? (
                              <Chip label="Healthy" color="success" size="small" />
                            ) : (
                              <Chip label="Unhealthy" color="error" size="small" />
                            )}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Success Rate</Typography>
                          <Typography variant="h6">{formatPercentage(latestMetrics?.redisSuccessRate || 0)}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Fallback Rate</Typography>
                          <Typography variant="h6">{formatPercentage(latestMetrics?.redisFallbackRate || 0)}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Circuit Trips</Typography>
                          <Typography variant="h6">{latestMetrics?.redisCircuitBreakerTrips || 0}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Total Operations</Typography>
                          <Typography variant="h6">{latestMetrics?.redisTotalOperations || 0}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Failed Operations</Typography>
                          <Typography variant="h6">{latestMetrics?.redisFailedOperations || 0}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Fallback Cache Size</Typography>
                          <Typography variant="h6">{latestMetrics?.redisFallbackCacheSize || 0}</Typography>
                        </Grid>
                      </Grid>
                    </Grid>

                    {/* Session Management Resilience */}
                    <Grid item xs={12} mt={2}>
                      <Typography variant="h6" gutterBottom>Session Management Resilience</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Lock Success Rate</Typography>
                          <Typography variant="h6">{formatPercentage(latestMetrics?.sessionLockSuccessRate || 0)}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Redis Failures</Typography>
                          <Typography variant="h6">{latestMetrics?.sessionRedisFailures || 0}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Stuck Sessions Cleared</Typography>
                          <Typography variant="h6">{latestMetrics?.sessionStuckSessionsCleared || 0}</Typography>
                        </Grid>
                        <Grid item xs={6} md={3}>
                          <Typography variant="body2" color="textSecondary">Orphaned Locks Cleared</Typography>
                          <Typography variant="h6">{latestMetrics?.sessionOrphanedLocksCleared || 0}</Typography>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                );
              })()}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <Card>
          <CardHeader 
            title={`Active Alerts (${activeAlerts.length})`}
            avatar={<NotificationsActiveIcon color="error" />}
          />
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Alert</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Count</TableCell>
                    <TableCell>Last Occurrence</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeAlerts.map(([alertId, alert]: [string, any]) => (
                    <TableRow key={alertId}>
                      <TableCell>
                        <Chip 
                          icon={getSeverityIcon(alert.severity)}
                          label={alert.severity}
                          color={getSeverityColor(alert.severity) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{alertId}</TableCell>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>{alert.occurrenceCount}</TableCell>
                      <TableCell>{new Date(alert.lastOccurrence).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedAlert({ alertId, ...alert });
                            setAlertDialogOpen(true);
                          }}
                          disabled={alert.acknowledged}
                        >
                          {alert.acknowledged ? 'Acknowledged' : 'Acknowledge'}
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

      {/* Alert Acknowledgment Dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)}>
        <DialogTitle>Acknowledge Alert</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedAlert.alertId}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {selectedAlert.message}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Severity: {selectedAlert.severity}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Occurrences: {selectedAlert.occurrenceCount}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                First occurred: {new Date(selectedAlert.firstOccurrence).toLocaleString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedAlert && acknowledgeAlert(selectedAlert.alertId)}
            variant="contained"
            color="primary"
          >
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComprehensiveMonitoringDashboard;