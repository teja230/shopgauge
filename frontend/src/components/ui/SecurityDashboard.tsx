import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  LinearProgress,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Badge,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper
} from '@mui/material';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Shield as ShieldIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Visibility as VisibilityIcon,
  Block as BlockIcon,
  VpnLock as VpnLockIcon,
  AdminPanelSettings as AdminIcon,
  Computer as ComputerIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import RefreshHeader from './RefreshHeader';

const SecurityCard = styled(Card)(({ theme }) => ({
  borderRadius: 20,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(6px)',
  boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.08)',
  },
}));

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
  },
}));

interface SecurityStats {
  failed_login_attempts: number;
  rate_limit_stats: {
    remaining_admin_requests: number;
    remaining_login_attempts: number;
    rate_limit_enabled: boolean;
  };
  recent_event_counts: Record<string, number>;
  unique_ip_addresses: number;
  hours_analyzed: number;
  timestamp: string;
}

interface SuspiciousActivity {
  suspicious_events: any[];
  suspicious_ips: Record<string, number>;
  failed_logins_by_ip: Record<string, number>;
  total_suspicious_events: number;
  hours_analyzed: number;
  analysis_timestamp: string;
}

const SecurityDashboard: React.FC = () => {
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSecurityData = async () => {
    try {
      setError(null);
      setRefreshing(true);
      
      const [statsResponse, suspiciousResponse] = await Promise.all([
        fetch('/api/admin/audit/security-stats'),
        fetch('/api/admin/audit/suspicious-activity')
      ]);

      if (!statsResponse.ok || !suspiciousResponse.ok) {
        throw new Error('Failed to fetch security data');
      }

      const [statsData, suspiciousData] = await Promise.all([
        statsResponse.json(),
        suspiciousResponse.json()
      ]);

      setSecurityStats(statsData);
      setSuspiciousActivity(suspiciousData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching security data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch security data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (cooldown > 0) return;
    
    setCooldown(180); // 3 minutes = 180 seconds
    await fetchSecurityData();
  };

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Initial load only - no auto-refresh
  useEffect(() => {
    fetchSecurityData();
  }, []);

  const getSecurityScore = () => {
    if (!securityStats || !suspiciousActivity) return 0;
    
    const baseScore = 100;
    const failedLoginPenalty = Math.min(securityStats.failed_login_attempts * 5, 30);
    const suspiciousActivityPenalty = Math.min(suspiciousActivity.total_suspicious_events * 3, 40);
    const uniqueIpBonus = Math.min(securityStats.unique_ip_addresses * 2, 10);
    
    return Math.max(0, baseScore - failedLoginPenalty - suspiciousActivityPenalty + uniqueIpBonus);
  };

  const getSecurityLevel = (score: number) => {
    if (score >= 90) return { level: 'Excellent', color: 'success', icon: <CheckCircleIcon /> };
    if (score >= 75) return { level: 'Good', color: 'info', icon: <ShieldIcon /> };
    if (score >= 60) return { level: 'Fair', color: 'warning', icon: <WarningIcon /> };
    return { level: 'Poor', color: 'error', icon: <ErrorIcon /> };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading security dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6">Error loading security data</Typography>
        <Typography>{error}</Typography>
        <Button onClick={handleRefresh} startIcon={<RefreshIcon />} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  const securityScore = getSecurityScore();
  const securityLevel = getSecurityLevel(securityScore);

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <SecurityIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
          <Typography variant="h4" component="h1">
            Security Dashboard
          </Typography>
        </Box>
        {lastUpdated && (
          <RefreshHeader
            lastUpdated={lastUpdated.toLocaleString()}
            onRefresh={handleRefresh}
            loading={refreshing}
            cooldown={cooldown > 0}
            cooldownRemaining={cooldown}
            label="Refresh Security Data"
            tooltip="Refresh security dashboard data"
          />
        )}
      </Box>

      {/* Security Score Overview */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
        <Box flex="1" minWidth="300px">
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              {securityLevel.icon}
              <Typography variant="h6" sx={{ ml: 1 }}>
                Security Score
              </Typography>
            </Box>
            <Box position="relative" display="inline-flex" mb={2}>
              <CircularProgress
                variant="determinate"
                value={securityScore}
                size={80}
                thickness={4}
                color={securityLevel.color as any}
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
                <Typography variant="h5" component="div" color="textSecondary">
                  {Math.round(securityScore)}
                </Typography>
              </Box>
            </Box>
            <Chip 
              label={securityLevel.level} 
              color={securityLevel.color as any}
              sx={{ fontWeight: 600 }}
            />
          </MetricCard>
        </Box>

        <Box flex="1" minWidth="300px">
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <WarningIcon color="warning" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Failed Logins
              </Typography>
            </Box>
            <Typography variant="h3" color="warning.main" gutterBottom>
              {securityStats?.failed_login_attempts || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last {securityStats?.hours_analyzed || 24} hours
            </Typography>
          </MetricCard>
        </Box>

        <Box flex="1" minWidth="300px">
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <ErrorIcon color="error" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Suspicious Events
              </Typography>
            </Box>
            <Typography variant="h3" color="error.main" gutterBottom>
              {suspiciousActivity?.total_suspicious_events || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last {suspiciousActivity?.hours_analyzed || 24} hours
            </Typography>
          </MetricCard>
        </Box>
      </Box>

      {/* Rate Limiting Status */}
      <Box display="flex" flexWrap="wrap" gap={3} mb={4}>
        <Box flex="1" minWidth="400px">
          <SecurityCard>
            <CardHeader 
              title="Rate Limiting Status" 
              avatar={<SpeedIcon color="primary" />}
            />
            <CardContent>
              {securityStats?.rate_limit_stats && (
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="body1">Rate Limiting</Typography>
                    <Chip 
                      label={securityStats.rate_limit_stats.rate_limit_enabled ? 'Enabled' : 'Disabled'}
                      color={securityStats.rate_limit_stats.rate_limit_enabled ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={2}>
                    <Box flex="1" minWidth="150px">
                      <Typography variant="body2" color="textSecondary">Admin Requests</Typography>
                      <Typography variant="h6">
                        {securityStats.rate_limit_stats.remaining_admin_requests}/10
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(securityStats.rate_limit_stats.remaining_admin_requests / 10) * 100}
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <Box flex="1" minWidth="150px">
                      <Typography variant="body2" color="textSecondary">Login Attempts</Typography>
                      <Typography variant="h6">
                        {securityStats.rate_limit_stats.remaining_login_attempts}/5
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(securityStats.rate_limit_stats.remaining_login_attempts / 5) * 100}
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Box>
                </Box>
              )}
            </CardContent>
          </SecurityCard>
        </Box>

        <Box flex="1" minWidth="400px">
          <SecurityCard>
            <CardHeader 
              title="Network Security" 
              avatar={<VpnLockIcon color="primary" />}
            />
            <CardContent>
              <Box display="flex" flexWrap="wrap" gap={2}>
                <Box flex="1" minWidth="150px">
                  <Typography variant="body2" color="textSecondary">Unique IP Addresses</Typography>
                  <Typography variant="h6">{securityStats?.unique_ip_addresses || 0}</Typography>
                </Box>
                <Box flex="1" minWidth="150px">
                  <Typography variant="body2" color="textSecondary">Suspicious IPs</Typography>
                  <Typography variant="h6" color="error.main">
                    {suspiciousActivity ? Object.keys(suspiciousActivity.suspicious_ips).length : 0}
                  </Typography>
                </Box>
                <Box width="100%">
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Failed Logins by IP
                  </Typography>
                  {suspiciousActivity?.failed_logins_by_ip && Object.keys(suspiciousActivity.failed_logins_by_ip).length > 0 ? (
                    <List dense>
                      {Object.entries(suspiciousActivity.failed_logins_by_ip)
                        .slice(0, 3)
                        .map(([ip, count]) => (
                          <ListItem key={ip} sx={{ px: 0 }}>
                            <ListItemIcon>
                              <ComputerIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={ip} 
                              secondary={`${count} failed attempts`}
                            />
                          </ListItem>
                        ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="success.main">
                      No suspicious IP activity detected
                    </Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </SecurityCard>
        </Box>
      </Box>

      {/* Recent Security Events */}
      <SecurityCard>
        <CardHeader 
          title="Recent Security Events" 
          avatar={<TimelineIcon color="primary" />}
        />
        <CardContent>
          {securityStats?.recent_event_counts && Object.keys(securityStats.recent_event_counts).length > 0 ? (
            <Box display="flex" flexWrap="wrap" gap={2}>
              {Object.entries(securityStats.recent_event_counts)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 6)
                .map(([event, count]) => (
                  <Box 
                    key={event}
                    flex="1"
                    minWidth="200px"
                    p={2} 
                    border={1} 
                    borderColor="divider" 
                    borderRadius={2}
                    bgcolor="background.paper"
                  >
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Typography variant="h6" color={getEventColor(event)}>
                      {count}
                    </Typography>
                  </Box>
                ))}
            </Box>
          ) : (
            <Typography variant="body1" color="textSecondary" textAlign="center" py={4}>
              No recent security events
            </Typography>
          )}
        </CardContent>
      </SecurityCard>
    </Box>
  );
};

const getEventColor = (event: string) => {
  if (event.includes('FAILED') || event.includes('BLOCKED') || event.includes('DENIED')) {
    return 'error.main';
  }
  if (event.includes('SUCCESS') || event.includes('AUTHORIZED')) {
    return 'success.main';
  }
  if (event.includes('WARNING') || event.includes('SUSPICIOUS')) {
    return 'warning.main';
  }
  return 'text.primary';
};

export default SecurityDashboard;