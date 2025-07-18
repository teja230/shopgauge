import React from 'react';
import {
  Button,
  Skeleton,
} from '@mui/material';
import { DashboardMetricsSkeleton } from './SkeletonLoaders';
import SectionErrorBoundary from './SectionErrorBoundary';
import NetworkStatusHandler from './NetworkStatusHandler';
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
} from '@mui/icons-material';

interface MetricCardData {
  title: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'error' | 'info';
  trend?: 'up' | 'down' | 'stable';
  description?: string;
  icon: React.ReactNode;
}

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: Date;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface DashboardOverviewProps {
  loading?: boolean;
  metrics?: MetricCardData[];
  alerts?: Alert[];
  quickActions?: QuickAction[];
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  loading = false,
  metrics = [],
  alerts = [],
  quickActions = [],
}) => {
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

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#ed6c02';
      default:
        return '#0288d1';
    }
  };

  // Default metrics if none provided
  const defaultMetrics: MetricCardData[] = [
    {
      title: 'System Health',
      value: 'Healthy',
      status: 'healthy',
      trend: 'stable',
      description: 'All systems operational',
      icon: <HealthyIcon />,
    },
    {
      title: 'Active Sessions',
      value: loading ? 0 : 12,
      status: 'info',
      trend: 'up',
      description: 'Currently active user sessions',
      icon: <PeopleIcon />,
    },
    {
      title: 'Connection Pool',
      value: loading ? '0%' : '45%',
      status: 'healthy',
      trend: 'stable',
      description: 'Database connection usage',
      icon: <StorageIcon />,
    },
    {
      title: 'Security Status',
      value: 'Secure',
      status: 'healthy',
      trend: 'stable',
      description: 'No security issues detected',
      icon: <SecurityIcon />,
    },
  ];

  const displayMetrics = metrics.length > 0 ? metrics : defaultMetrics;

  // Default quick actions if none provided
  const defaultQuickActions: QuickAction[] = [
    {
      id: 'view-sessions',
      title: 'View Active Sessions',
      description: 'Monitor current user sessions',
      icon: <PeopleIcon />,
      onClick: () => console.log('Navigate to sessions'),
    },
    {
      id: 'check-health',
      title: 'System Health Check',
      description: 'Run comprehensive health check',
      icon: <HealthyIcon />,
      onClick: () => console.log('Run health check'),
    },
    {
      id: 'view-logs',
      title: 'View Audit Logs',
      description: 'Review recent system activity',
      icon: <TimelineIcon />,
      onClick: () => console.log('Navigate to audit logs'),
    },
  ];

  const displayQuickActions = quickActions.length > 0 ? quickActions : defaultQuickActions;

  return (
    <SectionErrorBoundary sectionName="Dashboard Overview" level="section">
      <NetworkStatusHandler showPersistentIndicator={false} />
      <div className="admin-dashboard">
        <h1 className="admin-dashboard__title">
          Dashboard Overview
        </h1>

        {/* Metrics Cards */}
        {loading ? (
          <DashboardMetricsSkeleton count={4} />
        ) : (
          <div className="admin-dashboard__metrics admin-metrics-grid">
            {displayMetrics.map((metric, index) => (
              <SectionErrorBoundary 
                key={index} 
                sectionName={`${metric.title} Metric`} 
                level="component"
                showErrorDetails={false}
              >
                <div className="admin-metric-card admin-metric-card--interactive">
                  <div className="admin-metric-card__header">
                    <div style={{ color: getStatusColor(metric.status) }}>
                      {metric.icon}
                    </div>
                    <div className="admin-metric-card__trend">
                      {getTrendIcon(metric.trend)}
                    </div>
                  </div>
                  <h3 className="admin-metric-card__title">
                    {metric.title}
                  </h3>
                  <div className="admin-metric-card__value">
                    {metric.value}
                  </div>
                  <div className="admin-metric-card__description">
                    <span style={{ marginRight: '8px' }}>
                      {getStatusIcon(metric.status)}
                    </span>
                    {metric.description}
                  </div>
                </div>
              </SectionErrorBoundary>
            ))}
          </div>
        )}

      <div className="admin-dashboard__content">
        {/* Recent Alerts */}
        <SectionErrorBoundary sectionName="Recent Alerts" level="component">
          <div className="admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">Recent Alerts</h3>
            </div>
            <div className="admin-card__content">
              {loading ? (
                <div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="admin-mb-4">
                      <Skeleton variant="text" width="80%" height={20} />
                      <Skeleton variant="text" width="60%" height={16} />
                    </div>
                  ))}
                </div>
              ) : alerts.length === 0 ? (
                <div className="admin-text-center admin-py-4">
                  <HealthyIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                  <p className="admin-text-secondary">No recent alerts</p>
                </div>
              ) : (
                <div className="admin-alerts-list">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="admin-alert-item">
                      <div
                        className="admin-alert-indicator"
                        style={{
                          backgroundColor: getSeverityColor(alert.severity),
                        }}
                      />
                      <div className="admin-alert-content">
                        <div className="admin-alert-title">{alert.title}</div>
                        <div className="admin-alert-message">{alert.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionErrorBoundary>

        {/* Quick Actions */}
        <SectionErrorBoundary sectionName="Quick Actions" level="component">
          <div className="admin-card">
            <div className="admin-card__header">
              <h3 className="admin-card__title">Quick Actions</h3>
            </div>
            <div className="admin-card__content">
              {loading ? (
                <div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="admin-mb-4">
                      <Skeleton variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="admin-quick-actions">
                  {displayQuickActions.map((action) => (
                    <button
                      key={action.id}
                      className="admin-quick-action admin-interactive"
                      onClick={action.onClick}
                    >
                      <div className="admin-quick-action__icon" style={{ color: 'var(--admin-primary)' }}>
                        {action.icon}
                      </div>
                      <div className="admin-quick-action__content">
                        <div className="admin-quick-action__title">
                          {action.title}
                        </div>
                        <div className="admin-quick-action__description">
                          {action.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionErrorBoundary>
      </div>
    </div>
    </SectionErrorBoundary>
  );
};

export default DashboardOverview;