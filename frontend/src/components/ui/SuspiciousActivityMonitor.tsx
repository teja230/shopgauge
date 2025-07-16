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
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Security as SecurityIcon,
  Refresh as RefreshIcon,
  Computer as ComputerIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Block as BlockIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Report as ReportIcon,
  Shield as ShieldIcon,
  CheckCircle as CheckCircleIcon
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

const StyledTable = styled(Table)(({ theme }) => ({
  '& .MuiTableHead-root': {
    backgroundColor: theme.palette.grey[50],
  },
  '& .MuiTableCell-head': {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
  },
  '& .MuiTableRow-root:hover': {
    backgroundColor: theme.palette.action.hover,
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

interface SuspiciousEvent {
  id: number;
  event: string;
  username: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

interface SuspiciousActivity {
  suspicious_events: SuspiciousEvent[];
  suspicious_ips: Record<string, number>;
  failed_logins_by_ip: Record<string, number>;
  total_suspicious_events: number;
  hours_analyzed: number;
  analysis_timestamp: string;
}

const SuspiciousActivityMonitor: React.FC = () => {
  const [suspiciousActivity, setSuspiciousActivity] = useState<SuspiciousActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(24);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSuspiciousActivity = async () => {
    try {
      setError(null);
      setRefreshing(true);
      
      const response = await fetch(`/api/admin/audit/suspicious-activity?hours=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suspicious activity data');
      }
      
      const data = await response.json();
      setSuspiciousActivity(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching suspicious activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch suspicious activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (cooldown > 0) return;
    
    setCooldown(180); // 3 minutes = 180 seconds
    await fetchSuspiciousActivity();
  };

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Fetch data when time range changes
  useEffect(() => {
    fetchSuspiciousActivity();
  }, [timeRange]);

  // Initial load only - no auto-refresh
  useEffect(() => {
    fetchSuspiciousActivity();
  }, []);

  const getSeverityColor = (event: string) => {
    if (event.includes('FAILED') || event.includes('BLOCKED') || event.includes('DENIED')) {
      return 'error';
    }
    if (event.includes('SUSPICIOUS') || event.includes('WARNING')) {
      return 'warning';
    }
    return 'info';
  };

  const getSeverityIcon = (event: string) => {
    if (event.includes('FAILED') || event.includes('BLOCKED') || event.includes('DENIED')) {
      return <ErrorIcon />;
    }
    if (event.includes('SUSPICIOUS') || event.includes('WARNING')) {
      return <WarningIcon />;
    }
    return <SecurityIcon />;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatEventName = (event: string) => {
    return event.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading suspicious activity data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6">Error loading suspicious activity data</Typography>
        <Typography>{error}</Typography>
        <Button onClick={handleRefresh} startIcon={<RefreshIcon />} sx={{ mt: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <ReportIcon sx={{ fontSize: 32, color: 'error.main', mr: 2 }} />
          <Typography variant="h4" component="h1">
            Suspicious Activity Monitor
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <MenuItem value={1}>Last Hour</MenuItem>
              <MenuItem value={6}>Last 6 Hours</MenuItem>
              <MenuItem value={24}>Last 24 Hours</MenuItem>
              <MenuItem value={72}>Last 3 Days</MenuItem>
              <MenuItem value={168}>Last Week</MenuItem>
            </Select>
          </FormControl>
          {lastUpdated && (
            <RefreshHeader
              lastUpdated={lastUpdated.toLocaleString()}
              onRefresh={handleRefresh}
              loading={refreshing}
              cooldown={cooldown > 0}
              cooldownRemaining={cooldown}
              label="Refresh Suspicious Activity Data"
              tooltip="Refresh suspicious activity monitoring data"
            />
          )}
        </Stack>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <ErrorIcon color="error" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Total Events
              </Typography>
            </Box>
            <Typography variant="h3" color="error.main" gutterBottom>
              {suspiciousActivity?.total_suspicious_events || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last {suspiciousActivity?.hours_analyzed || timeRange} hours
            </Typography>
          </MetricCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <ComputerIcon color="warning" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Suspicious IPs
              </Typography>
            </Box>
            <Typography variant="h3" color="warning.main" gutterBottom>
              {suspiciousActivity ? Object.keys(suspiciousActivity.suspicious_ips).length : 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Unique addresses
            </Typography>
          </MetricCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <BlockIcon color="error" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Failed Logins
              </Typography>
            </Box>
            <Typography variant="h3" color="error.main" gutterBottom>
              {suspiciousActivity ? Object.values(suspiciousActivity.failed_logins_by_ip).reduce((a, b) => a + b, 0) : 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total attempts
            </Typography>
          </MetricCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
              <ShieldIcon color="info" />
              <Typography variant="h6" sx={{ ml: 1 }}>
                Threat Level
              </Typography>
            </Box>
            <Chip
              label={getThreatLevel(suspiciousActivity?.total_suspicious_events || 0)}
              color={getThreatLevelColor(suspiciousActivity?.total_suspicious_events || 0) as any}
              size="medium"
              sx={{ fontSize: '1.1rem', fontWeight: 600, mb: 1 }}
            />
            <Typography variant="body2" color="textSecondary">
              Current assessment
            </Typography>
          </MetricCard>
        </Grid>
      </Grid>

      {/* Suspicious IPs */}
      {suspiciousActivity && Object.keys(suspiciousActivity.suspicious_ips).length > 0 && (
        <SecurityCard sx={{ mb: 3 }}>
          <CardHeader 
            title="Suspicious IP Addresses" 
            avatar={
              <Badge badgeContent={Object.keys(suspiciousActivity.suspicious_ips).length} color="error">
                <ComputerIcon color="primary" />
              </Badge>
            }
          />
          <CardContent>
            <Grid container spacing={2}>
              {Object.entries(suspiciousActivity.suspicious_ips)
                .sort(([,a], [,b]) => b - a)
                .map(([ip, count]) => (
                  <Grid item xs={12} sm={6} md={4} key={ip}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        border: 1, 
                        borderColor: 'error.light',
                        bgcolor: 'error.50'
                      }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {ip}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {count} suspicious events
                          </Typography>
                        </Box>
                        <Chip 
                          label="High Risk" 
                          color="error" 
                          size="small"
                        />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
            </Grid>
          </CardContent>
        </SecurityCard>
      )}

      {/* Failed Logins by IP */}
      {suspiciousActivity && Object.keys(suspiciousActivity.failed_logins_by_ip).length > 0 && (
        <SecurityCard sx={{ mb: 3 }}>
          <CardHeader 
            title="Failed Login Attempts by IP" 
            avatar={<BlockIcon color="error" />}
          />
          <CardContent>
            <TableContainer>
              <StyledTable>
                <TableHead>
                  <TableRow>
                    <TableCell>IP Address</TableCell>
                    <TableCell align="right">Failed Attempts</TableCell>
                    <TableCell align="center">Risk Level</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(suspiciousActivity.failed_logins_by_ip)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .map(([ip, count]) => (
                      <TableRow key={ip}>
                        <TableCell>
                          <Box display="flex" alignItems="center">
                            <ComputerIcon fontSize="small" sx={{ mr: 1 }} />
                            {ip}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {count}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getRiskLevel(count as number)}
                            color={getRiskLevelColor(count as number) as any}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </StyledTable>
            </TableContainer>
          </CardContent>
        </SecurityCard>
      )}

      {/* Recent Suspicious Events */}
      <SecurityCard>
        <CardHeader 
          title="Recent Suspicious Events" 
          avatar={
            <Badge badgeContent={suspiciousActivity?.suspicious_events.length || 0} color="error">
              <TimelineIcon color="primary" />
            </Badge>
          }
        />
        <CardContent>
          {suspiciousActivity?.suspicious_events && suspiciousActivity.suspicious_events.length > 0 ? (
            <Stack spacing={2}>
              {suspiciousActivity.suspicious_events
                .slice(0, 10)
                .map((event, index) => (
                  <Accordion key={event.id || index}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box display="flex" alignItems="center" width="100%">
                        <Box display="flex" alignItems="center" mr={2}>
                          {getSeverityIcon(event.event)}
                        </Box>
                        <Box flexGrow={1}>
                          <Typography variant="body1" fontWeight={600}>
                            {formatEventName(event.event)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {formatTimestamp(event.timestamp)} • {event.ip_address}
                          </Typography>
                        </Box>
                        <Chip
                          label={getSeverityColor(event.event)}
                          color={getSeverityColor(event.event) as any}
                          size="small"
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            Event Details:
                          </Typography>
                          <Typography variant="body2">
                            {event.details}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            Event Information:
                          </Typography>
                          <Stack spacing={1}>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Username:</Typography>
                              <Typography variant="body2">{event.username}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">IP Address:</Typography>
                              <Typography variant="body2">{event.ip_address}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between">
                              <Typography variant="body2">Timestamp:</Typography>
                              <Typography variant="body2">{formatTimestamp(event.timestamp)}</Typography>
                            </Box>
                          </Stack>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
            </Stack>
          ) : (
            <Box textAlign="center" py={4}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main" gutterBottom>
                No Suspicious Activity Detected
              </Typography>
              <Typography variant="body2" color="textSecondary">
                No suspicious events found in the last {suspiciousActivity?.hours_analyzed || timeRange} hours.
              </Typography>
            </Box>
          )}
        </CardContent>
      </SecurityCard>
    </Box>
  );
};

const getThreatLevel = (eventCount: number) => {
  if (eventCount === 0) return 'Low';
  if (eventCount < 5) return 'Medium';
  if (eventCount < 15) return 'High';
  return 'Critical';
};

const getThreatLevelColor = (eventCount: number) => {
  if (eventCount === 0) return 'success';
  if (eventCount < 5) return 'info';
  if (eventCount < 15) return 'warning';
  return 'error';
};

const getRiskLevel = (failedAttempts: number) => {
  if (failedAttempts < 3) return 'Low';
  if (failedAttempts < 5) return 'Medium';
  if (failedAttempts < 10) return 'High';
  return 'Critical';
};

const getRiskLevelColor = (failedAttempts: number) => {
  if (failedAttempts < 3) return 'success';
  if (failedAttempts < 5) return 'info';
  if (failedAttempts < 10) return 'warning';
  return 'error';
};

export default SuspiciousActivityMonitor;