import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  ChevronDown as ExpandMoreIcon,
  MemoryStick as MemoryIcon,
  Gauge as SpeedIcon,
  Database as StorageIcon,
  ShieldCheck as SecurityIcon,
  AlertTriangle as WarningIcon,
  CheckCircle2 as CheckCircleIcon,
  AlertCircle as ErrorIcon,
  Info as InfoIcon,
  RefreshCw as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  ClipboardList as AssessmentIcon,
} from 'lucide-react';
import { 
  getEnterpriseHealth, 
  getMemoryProfileStatus, 
  getRequestThrottlingStats,
  validateConfiguration,
  revalidateConfiguration 
} from '../../api/admin';
import { useNotifications } from '../../hooks/useNotifications';

interface EnterpriseHealthPanelProps {
  onRefresh?: () => void;
}

const EnterpriseHealthPanel: React.FC<EnterpriseHealthPanelProps> = ({ onRefresh }) => {
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enterpriseHealth, setEnterpriseHealth] = useState<any>(null);
  const [memoryProfile, setMemoryProfile] = useState<any>(null);
  const [throttlingStats, setThrottlingStats] = useState<any>(null);
  const [configValidation, setConfigValidation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnterpriseData();
  }, []);

  const loadEnterpriseData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthData, profileData, throttlingData, configData] = await Promise.all([
        getEnterpriseHealth(),
        getMemoryProfileStatus(),
        getRequestThrottlingStats(),
        validateConfiguration()
      ]);

      setEnterpriseHealth(healthData);
      setMemoryProfile(profileData);
      setThrottlingStats(throttlingData);
      setConfigValidation(configData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load enterprise data';
      setError(errorMessage);
      addNotification('Failed to load enterprise health data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEnterpriseData();
      addNotification('Enterprise health data refreshed', 'success');
      onRefresh?.();
    } catch (err) {
      addNotification('Failed to refresh enterprise data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevalidateConfig = async () => {
    try {
      const result = await revalidateConfiguration();
      setConfigValidation(result.validation || result);
      addNotification('Configuration revalidated successfully', 'success');
    } catch (err) {
      addNotification('Failed to revalidate configuration', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'HEALTHY': return 'success';
      case 'CAUTION': return 'warning';
      case 'WARNING': return 'warning';
      case 'CRITICAL': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'HEALTHY': return <CheckCircleIcon color="#059669" />;
      case 'CAUTION': return <WarningIcon color="#f59e0b" />;
      case 'WARNING': return <WarningIcon color="#f59e0b" />;
      case 'CRITICAL': return <ErrorIcon color="#dc2626" />;
      default: return <InfoIcon color="#0ea5a6" />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading enterprise health data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" action={
        <Button color="inherit" size="small" onClick={loadEnterpriseData}>
          Retry
        </Button>
      }>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Enterprise Health Dashboard
        </Typography>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* System Status Overview */}
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <AssessmentIcon style={{ marginRight: 8 }} />
              <Typography variant="h6">System Status</Typography>
            </Box>
            
            {enterpriseHealth && (
              <Box>
                <Box display="flex" alignItems="center" mb={2}>
                  {getStatusIcon(enterpriseHealth.status)}
                  <Typography variant="h4" sx={{ ml: 1 }}>
                    {enterpriseHealth.status || 'Unknown'}
                  </Typography>
                  <Chip 
                    label={enterpriseHealth.deploymentMode || 'Unknown'} 
                    color={enterpriseHealth.deploymentMode === 'PRODUCTION' ? 'success' : 'warning'}
                    size="small"
                    sx={{ ml: 2 }}
                  />
                </Box>
                
                {enterpriseHealth.capacity && (
                  <Box mb={2}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Capacity Utilization
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={parseInt(enterpriseHealth.capacity.currentUtilization) || 0}
                      color={enterpriseHealth.capacity.status === 'HEALTHY_CAPACITY' ? 'success' : 'warning'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {enterpriseHealth.capacity.currentUtilization} used, {enterpriseHealth.capacity.headroom} headroom
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Memory Profile Status */}
        <Card>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MemoryIcon style={{ marginRight: 8 }} />
                <Typography variant="h6">Memory Profile</Typography>
              </Box>
              
              {memoryProfile && (
                <Box>
                  <Typography variant="h4" gutterBottom>
                    {memoryProfile.currentProfile}
                  </Typography>
                  
                  <Box display="flex" gap={1} mb={2}>
                    {memoryProfile.isEmergencyMode && (
                      <Chip label="Emergency Mode" color="error" size="small" />
                    )}
                    {memoryProfile.isBalancedMode && (
                      <Chip label="Balanced Mode" color="success" size="small" />
                    )}
                    {memoryProfile.isPerformanceMode && (
                      <Chip label="Performance Mode" color="primary" size="small" />
                    )}
                  </Box>

                  {memoryProfile.jvmMemory && (
                    <Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        JVM Memory Usage
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={memoryProfile.jvmMemory.usagePercent || 0}
                        color={memoryProfile.jvmMemory.usagePercent > 85 ? 'error' : 
                               memoryProfile.jvmMemory.usagePercent > 70 ? 'warning' : 'success'}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {memoryProfile.jvmMemory.usedMemoryMB}MB / {memoryProfile.jvmMemory.maxMemoryMB}MB 
                        ({memoryProfile.jvmMemory.usagePercent}%)
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Card>

        {/* Request Throttling Status */}
        {throttlingStats && throttlingStats.throttlingEnabled && (
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SpeedIcon style={{ marginRight: 8 }} />
                <Typography variant="h6">Request Throttling</Typography>
                <Chip label="Active" color="warning" size="small" sx={{ ml: 1 }} />
              </Box>
              
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Max Concurrent: {throttlingStats.maxConcurrentRequests} per shop
              </Typography>
              
              {throttlingStats.shops && Object.keys(throttlingStats.shops).length > 0 && (
                <Box mt={2}>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Active Shops: {Object.keys(throttlingStats.shops).length}
                  </Typography>
                  {Object.entries(throttlingStats.shops).slice(0, 3).map(([shop, stats]: [string, any]) => (
                    <Box key={shop} display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" noWrap sx={{ maxWidth: 200 }}>
                        {shop}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {stats.availablePermits}/{stats.maxPermits} available
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configuration Validation */}
        <Card>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center">
                  <SettingsIcon style={{ marginRight: 8 }} />
                  <Typography variant="h6">Configuration</Typography>
                </Box>
                <Button 
                  size="small" 
                  onClick={handleRevalidateConfig}
                  startIcon={<RefreshIcon />}
                >
                  Revalidate
                </Button>
              </Box>
              
              {configValidation && (
                <Box>
                  <Chip 
                    label={configValidation.status || 'Unknown'}
                    color={configValidation.status === 'VALID' ? 'success' : 'error'}
                    sx={{ mb: 2 }}
                  />
                  
                  {configValidation.errorCount > 0 && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {configValidation.errorCount} configuration error(s) found
                    </Alert>
                  )}
                  
                  {configValidation.warningCount > 0 && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      {configValidation.warningCount} configuration warning(s)
                    </Alert>
                  )}
                  
                  {configValidation.configuration && (
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        Memory Profile: {configValidation.configuration.memoryProfile}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        DB Pool: {configValidation.configuration.dbPoolSize} connections
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Tomcat Threads: {configValidation.configuration.tomcatMaxThreads}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Card>

        {/* Recommendations */}
        {enterpriseHealth?.recommendations && enterpriseHealth.recommendations.length > 0 && (
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box display="flex" alignItems="center">
                <TrendingUpIcon style={{ marginRight: 8 }} />
                <Typography variant="h6">
                  Intelligent Recommendations ({enterpriseHealth.recommendations.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {enterpriseHealth.recommendations.map((rec: any, index: number) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {rec.type === 'CRITICAL' ? <ErrorIcon color="#dc2626" /> :
                         rec.type === 'OPTIMIZATION' ? <TrendingUpIcon color="#f59e0b" /> :
                         <InfoIcon color="#0ea5a6" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={rec.title}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {rec.description}
                            </Typography>
                            <Typography variant="caption" color="primary">
                              Action: {rec.action}
                            </Typography>
                            <Chip 
                              label={rec.priority} 
                              size="small" 
                              color={rec.priority === 'HIGH' ? 'error' : 
                                     rec.priority === 'MEDIUM' ? 'warning' : 'default'}
                              sx={{ ml: 1 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < enterpriseHealth.recommendations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Active Alerts */}
        {enterpriseHealth?.alerts && enterpriseHealth.alerts.length > 0 && (
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <WarningIcon style={{ marginRight: 8 }} />
                <Typography variant="h6">
                  Active Alerts ({enterpriseHealth.alerts.length})
                </Typography>
              </Box>
              
              {enterpriseHealth.alerts.map((alert: any, index: number) => (
                <Alert 
                  key={index}
                  severity={alert.severity === 'CRITICAL' ? 'error' : 
                           alert.severity === 'WARNING' ? 'warning' : 'info'}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {alert.message}
                  </Typography>
                  {alert.action && (
                    <Typography variant="caption" display="block">
                      Recommended Action: {alert.action}
                    </Typography>
                  )}
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default EnterpriseHealthPanel;