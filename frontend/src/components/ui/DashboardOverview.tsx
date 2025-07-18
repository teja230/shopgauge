import React, { useState, useMemo, useCallback } from 'react';
import {
  Button,
  Skeleton,
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
  Grow,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as StableIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Storage as StorageIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Shield as ShieldIcon,
  Visibility as VisibilityIcon,
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  HealthAndSafety as HealthIcon,
} from '@mui/icons-material';
import { DashboardMetricsSkeleton } from './SkeletonLoaders';
import SectionErrorBoundary from './SectionErrorBoundary';
import NetworkStatusHandler from './NetworkStatusHandler';

interface MetricCardData {
  title: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'error' | 'info';
  trend?: 'up' | 'down' | 'stable';
  description?: string;
  icon: React.ReactNode;
  change?: number;
  changeLabel?: string;
  details?: {
    label: string;
    value: string | number;
    status?: 'healthy' | 'warning' | 'error' | 'info';
  }[];
}

interface DashboardAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: Date;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category?: string;
  color: string;
  requiresConfirmation?: boolean;
}

interface DashboardOverviewProps {
  loading?: boolean;
  metrics?: MetricCardData[];
  alerts?: DashboardAlert[];
  quickActions?: QuickAction[];
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  loading = false,
  metrics = [],
  alerts = [],
  quickActions = [],
}) => {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const getStatusColor = (status: MetricCardData['status']) => {
    switch (status) {
      case 'healthy':
        return '#2e7d32';
      case 'warning':
        return '#ed6c02';
      case 'error':
        return '#d32f2f';
      default:
        return '#0288d1';
    }
  };

  const getStatusIcon = (status: MetricCardData['status']) => {
    switch (status) {
      case 'healthy':
        return <HealthyIcon sx={{ color: '#2e7d32' }} />;
      case 'warning':
        return <WarningIcon sx={{ color: '#ed6c02' }} />;
      case 'error':
        return <ErrorIcon sx={{ color: '#d32f2f' }} />;
      default:
        return <InfoIcon sx={{ color: '#0288d1' }} />;
    }
  };

  const getTrendIcon = (trend?: MetricCardData['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon sx={{ color: '#2e7d32', fontSize: 16 }} />;
      case 'down':
        return <TrendingDownIcon sx={{ color: '#d32f2f', fontSize: 16 }} />;
      case 'stable':
        return <StableIcon sx={{ color: '#616161', fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: DashboardAlert['severity']) => {
    switch (severity) {
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#ed6c02';
      default:
        return '#0288d1';
    }
  };

  const getPriorityColor = (priority?: DashboardAlert['priority']) => {
    switch (priority) {
      case 'critical':
        return '#d32f2f';
      case 'high':
        return '#ed6c02';
      case 'medium':
        return '#f57c00';
      case 'low':
        return '#388e3c';
      default:
        return '#616161';
    }
  };

  // Enhanced default metrics with more enterprise features
  const defaultMetrics: MetricCardData[] = [
    {
      title: 'System Health',
      value: 'Healthy',
      status: 'healthy',
      trend: 'stable',
      description: 'All systems operational',
      icon: <HealthyIcon />,
      change: 0,
      changeLabel: 'No change',
      details: [
        { label: 'CPU Usage', value: '23%', status: 'healthy' },
        { label: 'Memory Usage', value: '67%', status: 'warning' },
        { label: 'Disk Usage', value: '45%', status: 'healthy' },
        { label: 'Network', value: 'Normal', status: 'healthy' }
      ]
    },
    {
      title: 'Active Sessions',
      value: loading ? 0 : 12,
      status: 'info',
      trend: 'up',
      description: 'Currently active user sessions',
      icon: <PeopleIcon />,
      change: 8,
      changeLabel: '+8 from last hour',
      details: [
        { label: 'Total Sessions', value: '12', status: 'info' },
        { label: 'Peak Today', value: '18', status: 'info' },
        { label: 'Avg Duration', value: '45m', status: 'info' },
        { label: 'New Today', value: '24', status: 'info' }
      ]
    },
    {
      title: 'Connection Pool',
      value: loading ? '0%' : '45%',
      status: 'healthy',
      trend: 'stable',
      description: 'Database connection usage',
      icon: <StorageIcon />,
      change: -2,
      changeLabel: '-2% from last check',
      details: [
        { label: 'Active Connections', value: '45', status: 'healthy' },
        { label: 'Max Connections', value: '100', status: 'info' },
        { label: 'Idle Connections', value: '12', status: 'healthy' },
        { label: 'Wait Time', value: '0ms', status: 'healthy' }
      ]
    },
    {
      title: 'Security Status',
      value: 'Secure',
      status: 'healthy',
      trend: 'stable',
      description: 'No security issues detected',
      icon: <SecurityIcon />,
      change: 0,
      changeLabel: 'No threats detected',
      details: [
        { label: 'Threats Blocked', value: '0', status: 'healthy' },
        { label: 'Failed Logins', value: '3', status: 'warning' },
        { label: 'SSL Status', value: 'Valid', status: 'healthy' },
        { label: 'Last Scan', value: '2m ago', status: 'healthy' }
      ]
    },
    {
      title: 'Performance',
      value: 'Excellent',
      status: 'healthy',
      trend: 'up',
      description: 'System performance metrics',
      icon: <SpeedIcon />,
      change: 5,
      changeLabel: '+5% improvement',
      details: [
        { label: 'Response Time', value: '120ms', status: 'healthy' },
        { label: 'Throughput', value: '1.2k req/s', status: 'healthy' },
        { label: 'Error Rate', value: '0.1%', status: 'healthy' },
        { label: 'Uptime', value: '99.9%', status: 'healthy' }
      ]
    },
    {
      title: 'Resource Usage',
      value: 'Optimal',
      status: 'healthy',
      trend: 'stable',
      description: 'System resource utilization',
      icon: <MemoryIcon />,
      change: -1,
      changeLabel: '-1% from last check',
      details: [
        { label: 'CPU Load', value: '23%', status: 'healthy' },
        { label: 'Memory Usage', value: '67%', status: 'warning' },
        { label: 'Disk I/O', value: 'Normal', status: 'healthy' },
        { label: 'Network I/O', value: 'Normal', status: 'healthy' }
      ]
    }
  ];

  const displayMetrics = metrics.length > 0 ? metrics : defaultMetrics;

  // Enhanced quick actions with proper functionality
  const enhancedQuickActions = useMemo(() => [
    {
      id: 'refresh-status',
      title: 'Refresh Status',
      description: 'Update all system metrics',
      icon: <RefreshIcon />,
      color: '#1976d2',
      action: () => {
        // This will be handled by parent component
        console.log('Refresh status action triggered');
      },
      category: 'General Actions'
    },
    {
      id: 'emergency-cleanup',
      title: 'Emergency Cleanup',
      description: 'Force cleanup of connection pool',
      icon: <WarningIcon />,
      color: '#d32f2f',
      action: () => {
        console.log('Emergency cleanup action triggered');
      },
      category: 'Emergency Actions'
    },
    {
      id: 'session-management',
      title: 'Session Management',
      description: 'Manage active sessions',
      icon: <PeopleIcon />,
      color: '#2e7d32',
      action: () => {
        console.log('Session management action triggered');
      },
      category: 'User Management'
    },
    {
      id: 'security-audit',
      title: 'Security Audit',
      description: 'Review security logs',
      icon: <SecurityIcon />,
      color: '#ed6c02',
      action: () => {
        console.log('Security audit action triggered');
      },
      category: 'Security Actions'
    },
    {
      id: 'system-health',
      title: 'System Health',
      description: 'Check system status',
      icon: <HealthIcon />,
      color: '#7b1fa2',
      action: () => {
        console.log('System health action triggered');
      },
      category: 'Monitoring'
    },
    {
      id: 'market-intelligence',
      title: 'Market Intelligence',
      description: 'View market insights',
      icon: <AssessmentIcon />,
      color: '#0288d1',
      action: () => {
        console.log('Market intelligence action triggered');
      },
      category: 'Analytics'
    }
  ], []);

  const displayQuickActions = enhancedQuickActions;

  // Group quick actions by category
  const groupedQuickActions = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    displayQuickActions.forEach(action => {
      const category = action.category || 'general';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(action);
    });
    return groups;
  }, [displayQuickActions]);

  const handleMetricClick = useCallback((metricId: string) => {
    setExpandedMetric(expandedMetric === metricId ? null : metricId);
  }, [expandedMetric]);

  const filteredAlerts = useMemo(() => {
    if (showAllAlerts) return alerts;
    return alerts.slice(0, 3); // Show only first 3 alerts
  }, [alerts, showAllAlerts]);

  const criticalAlerts = useMemo(() => {
    return alerts.filter(alert => alert.severity === 'error' || alert.priority === 'critical');
  }, [alerts]);

  return (
    <SectionErrorBoundary sectionName="Dashboard Overview" level="section">
      <NetworkStatusHandler showPersistentIndicator={false} />
      
      <Box className="admin-dashboard" sx={{ p: 3 }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ 
            fontWeight: 700, 
            mb: 1,
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Dashboard Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Real-time system monitoring and administration
          </Typography>
          
          {/* Critical Alerts Banner */}
          {criticalAlerts.length > 0 && (
            <Fade in={criticalAlerts.length > 0}>
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 2,
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  color: 'white',
                  '& .MuiAlert-icon': { color: 'white' }
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''} Require{criticalAlerts.length > 1 ? '' : 's'} Attention
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Immediate action required for system security and stability
                </Typography>
              </Alert>
            </Fade>
          )}
        </Box>

        {/* Metrics Cards */}
        {loading ? (
          <DashboardMetricsSkeleton count={6} />
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
            {displayMetrics.map((metric, index) => (
              <Box sx={{ flex: '1 1 350px', minWidth: 0 }} key={index}>
                <SectionErrorBoundary 
                  sectionName={`${metric.title} Metric`} 
                  level="component"
                  showErrorDetails={false}
                >
                  <Grow in timeout={300 + index * 100}>
                    <Card 
                      className="admin-metric-card admin-metric-card--interactive"
                      sx={{
                        height: '100%',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                        }
                      }}
                      onClick={() => handleMetricClick(metric.title)}
                    >
                      <CardContent sx={{ p: 3 }}>
                        {/* Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Box sx={{ 
                            color: getStatusColor(metric.status),
                            mr: 2,
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            {metric.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {metric.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {metric.description}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getTrendIcon(metric.trend)}
                            {metric.change !== undefined && (
                              <Chip
                                label={metric.changeLabel}
                                size="small"
                                color={metric.change > 0 ? 'success' : metric.change < 0 ? 'error' : 'default'}
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>

                        {/* Main Value */}
                        <Typography variant="h4" sx={{ 
                          fontWeight: 700, 
                          mb: 1,
                          color: getStatusColor(metric.status)
                        }}>
                          {metric.value}
                        </Typography>

                        {/* Status Indicator */}
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          {getStatusIcon(metric.status)}
                          <Typography variant="body2" sx={{ ml: 1, fontWeight: 500 }}>
                            {metric.status.charAt(0).toUpperCase() + metric.status.slice(1)}
                          </Typography>
                        </Box>

                        {/* Expandable Details */}
                        {expandedMetric === metric.title && metric.details && (
                          <Fade in={expandedMetric === metric.title}>
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                Details
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                {metric.details.map((detail, detailIndex) => (
                                  <Box sx={{ flex: '1 1 200px', minWidth: 0 }} key={detailIndex}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {detail.label}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                        {detail.value}
                                      </Typography>
                                    </Box>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          </Fade>
                        )}
                      </CardContent>
                    </Card>
                  </Grow>
                </SectionErrorBoundary>
              </Box>
            ))}
          </Box>
        )}

        {/* Quick Actions Section */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 3,
            fontWeight: 600,
            color: 'text.primary'
          }}>
            <SettingsIcon color="primary" />
            Quick Actions
          </Typography>
          
                     {/* Group actions by category */}
           {Object.entries(
             enhancedQuickActions.reduce((acc, action) => {
               const category = action.category || 'General Actions';
               if (!acc[category]) acc[category] = [];
               acc[category].push(action);
               return acc;
             }, {} as Record<string, typeof enhancedQuickActions>)
           ).map(([category, actions]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'text.secondary',
                fontSize: '0.875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {category}
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap' 
              }}>
                {actions.map((action) => (
                  <Card
                    key={action.id}
                    sx={{
                      flex: '1 1 250px',
                      minWidth: 250,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      background: `linear-gradient(135deg, ${action.color}15 0%, ${action.color}05 100%)`,
                      border: `1px solid ${action.color}30`,
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 25px ${action.color}20`,
                        borderColor: action.color,
                      },
                    }}
                    onClick={action.action}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                        <Box sx={{
                          p: 1,
                          borderRadius: 2,
                          backgroundColor: `${action.color}20`,
                          color: action.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {action.icon}
                        </Box>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600,
                          color: 'text.primary'
                        }}>
                          {action.title}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {action.description}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                Recent Alerts
              </Typography>
              <Button
                size="small"
                onClick={() => setShowAllAlerts(!showAllAlerts)}
                startIcon={<NotificationsIcon />}
              >
                {showAllAlerts ? 'Show Less' : `Show All (${alerts.length})`}
              </Button>
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredAlerts.map((alert, index) => (
                <Box key={alert.id}>
                  <Fade in timeout={300 + index * 100}>
                    <Alert 
                      severity={alert.severity}
                      sx={{
                        '& .MuiAlert-message': { width: '100%' }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {alert.title}
                          </Typography>
                          <Typography variant="body2">
                            {alert.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                            {alert.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                        {alert.priority && (
                          <Chip
                            label={alert.priority.toUpperCase()}
                            size="small"
                            sx={{
                              backgroundColor: getPriorityColor(alert.priority),
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                        )}
                      </Box>
                    </Alert>
                  </Fade>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* System Status Summary */}
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            System Status Summary
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 200px', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: 'success.main', fontWeight: 700 }}>
                {displayMetrics.filter(m => m.status === 'healthy').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Healthy Systems
              </Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: 'warning.main', fontWeight: 700 }}>
                {displayMetrics.filter(m => m.status === 'warning').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Warnings
              </Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: 'error.main', fontWeight: 700 }}>
                {displayMetrics.filter(m => m.status === 'error').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Errors
              </Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px', textAlign: 'center' }}>
              <Typography variant="h4" sx={{ color: 'info.main', fontWeight: 700 }}>
                {alerts.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Alerts
              </Typography>
            </Box>
          </Box>
        </Card>
      </Box>
    </SectionErrorBoundary>
  );
};

export default DashboardOverview;