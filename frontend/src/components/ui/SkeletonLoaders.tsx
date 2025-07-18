import React from 'react';
import { Box, Skeleton, Card, CardContent, Stack, useTheme } from '@mui/material';
import { styled } from '@mui/material/styles';

// Styled Components for consistent skeleton appearance
const SkeletonContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  '& .MuiSkeleton-root': {
    backgroundColor: theme.palette.grey[100],
    '&::after': {
      background: `linear-gradient(90deg, transparent, ${theme.palette.grey[50]}, transparent)`,
    },
  },
}));

const SkeletonCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  borderRadius: 12,
}));

// Dashboard Metric Cards Skeleton
export const DashboardMetricsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index}>
          <CardContent sx={{ p: 3 }}>
            <Stack spacing={2}>
              {/* Header with icon and title */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="circular" width={40} height={40} data-testid="skeleton-icon" />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="60%" height={20} data-testid="skeleton-title" />
                  <Skeleton variant="text" width="40%" height={16} data-testid="skeleton-subtitle" />
                </Stack>
              </Stack>
              
              {/* Main metric value */}
              <Skeleton variant="text" width="80%" height={48} sx={{ fontSize: '2rem' }} data-testid="skeleton-metric" />
              
              {/* Trend indicator */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 12 }} data-testid="skeleton-trend" />
                <Skeleton variant="text" width="40%" height={16} data-testid="skeleton-trend-text" />
              </Stack>
              
              {/* Progress bar or chart */}
              <Skeleton variant="rectangular" width="100%" height={8} sx={{ borderRadius: 4 }} data-testid="skeleton-progress" />
            </Stack>
          </CardContent>
        </SkeletonCard>
      ))}
    </Box>
  );
};

// Data Table Skeleton with proper structure
export const DataTableSkeleton: React.FC<{ 
  columns?: number; 
  rows?: number; 
  hasHeader?: boolean;
  hasSearch?: boolean;
  hasFilters?: boolean;
}> = ({ 
  columns = 5, 
  rows = 8, 
  hasHeader = true,
  hasSearch = true,
  hasFilters = false
}) => {
  return (
    <SkeletonContainer>
      <Card sx={{ borderRadius: 2, overflow: 'hidden' }}>
        {/* Search bar */}
        {hasSearch && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} data-testid="skeleton-search" />
          </Box>
        )}
        
        {/* Filter controls */}
        {hasFilters && (
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
            <Stack direction="row" spacing={2}>
              <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-filter" />
              <Skeleton variant="rectangular" width={150} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-filter" />
              <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-filter" />
            </Stack>
          </Box>
        )}
        
        {/* Table header */}
        {hasHeader && (
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: '2px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={3}>
              {Array.from({ length: columns }).map((_, index) => (
                <Skeleton 
                  key={index} 
                  variant="text" 
                  width={index === 0 ? '25%' : '15%'} 
                  height={20} 
                  data-testid="skeleton-header"
                />
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Table rows */}
        <Box>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <Box 
              key={rowIndex} 
              sx={{ 
                p: 2, 
                borderBottom: '1px solid', 
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' }
              }}
            >
              <Stack direction="row" spacing={3} alignItems="center">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton 
                    key={colIndex} 
                    variant="text" 
                    width={
                      colIndex === 0 ? '25%' : 
                      colIndex === columns - 1 ? '10%' : '15%'
                    } 
                    height={20} 
                    data-testid="skeleton-cell"
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
        
        {/* Pagination */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={150} height={20} />
            <Stack direction="row" spacing={1}>
              <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} />
            </Stack>
          </Stack>
        </Box>
      </Card>
    </SkeletonContainer>
  );
};

// Chart/Analytics Skeleton
export const ChartSkeleton: React.FC<{ height?: number; title?: boolean }> = ({ 
  height = 300, 
  title = true 
}) => {
  return (
    <SkeletonCard>
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Chart title and controls */}
          {title && (
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack spacing={1}>
                <Skeleton variant="text" width="40%" height={24} data-testid="skeleton-chart-title" />
                <Skeleton variant="text" width="60%" height={16} data-testid="skeleton-chart-subtitle" />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-chart-control" />
                <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-chart-control" />
              </Stack>
            </Stack>
          )}
          
          {/* Chart area */}
          <Box sx={{ position: 'relative' }}>
            <Skeleton variant="rectangular" width="100%" height={height} sx={{ borderRadius: 1 }} data-testid="skeleton-chart-area" />
            
            {/* Overlay some chart-like elements */}
            <Box sx={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 20 }}>
              <Stack spacing={2}>
                {/* Y-axis labels */}
                <Stack spacing={3} sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40 }}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} variant="text" width="100%" height={12} data-testid="skeleton-chart-y-label" />
                  ))}
                </Stack>
                
                {/* Chart bars/lines simulation */}
                <Box sx={{ ml: 6, mt: 2, display: 'flex', alignItems: 'end', gap: 1, height: height - 80 }}>
                  {Array.from({ length: 12 }).map((_, index) => (
                    <Skeleton 
                      key={index} 
                      variant="rectangular" 
                      width={20} 
                      height={Math.random() * (height - 120) + 20}
                      sx={{ borderRadius: '2px 2px 0 0' }}
                      data-testid="skeleton-chart-bar"
                    />
                  ))}
                </Box>
                
                {/* X-axis labels */}
                <Box sx={{ ml: 6, display: 'flex', justifyContent: 'space-between' }}>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} variant="text" width={40} height={12} data-testid="skeleton-chart-x-label" />
                  ))}
                </Box>
              </Stack>
            </Box>
          </Box>
          
          {/* Legend */}
          <Stack direction="row" spacing={3} justifyContent="center">
            {Array.from({ length: 3 }).map((_, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center">
                <Skeleton variant="rectangular" width={12} height={12} sx={{ borderRadius: 1 }} data-testid="skeleton-chart-legend" />
                <Skeleton variant="text" width={60} height={16} data-testid="skeleton-chart-legend-text" />
              </Stack>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </SkeletonCard>
  );
};

// List/Feed Skeleton
export const ListSkeleton: React.FC<{ items?: number; showAvatar?: boolean }> = ({ 
  items = 6, 
  showAvatar = true 
}) => {
  return (
    <SkeletonContainer>
      <Stack spacing={2}>
        {Array.from({ length: items }).map((_, index) => (
          <Card key={index} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              {showAvatar && (
                <Skeleton variant="circular" width={48} height={48} data-testid="skeleton-avatar" />
              )}
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" height={20} data-testid="skeleton-title" />
                <Skeleton variant="text" width="100%" height={16} data-testid="skeleton-description" />
                <Skeleton variant="text" width="60%" height={16} data-testid="skeleton-meta" />
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 12 }} data-testid="skeleton-tag" />
                  <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} data-testid="skeleton-tag" />
                </Stack>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Stack>
    </SkeletonContainer>
  );
};

// Form Skeleton
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 5 }) => {
  return (
    <SkeletonContainer>
      <Card sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Form title */}
          <Skeleton variant="text" width="40%" height={32} data-testid="skeleton-form-title" />
          
          {/* Form fields */}
          {Array.from({ length: fields }).map((_, index) => (
            <Stack key={index} spacing={1}>
              <Skeleton variant="text" width="20%" height={20} data-testid="skeleton-field-label" />
              <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} data-testid="skeleton-field-input" />
            </Stack>
          ))}
          
          {/* Action buttons */}
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Skeleton variant="rectangular" width={120} height={40} sx={{ borderRadius: 1 }} data-testid="skeleton-button" />
            <Skeleton variant="rectangular" width={80} height={40} sx={{ borderRadius: 1 }} data-testid="skeleton-button" />
          </Stack>
        </Stack>
      </Card>
    </SkeletonContainer>
  );
};

// Page Layout Skeleton (for full page loading)
export const PageSkeleton: React.FC<{ 
  hasHeader?: boolean; 
  hasSidebar?: boolean;
  contentType?: 'dashboard' | 'table' | 'form' | 'chart';
}> = ({ 
  hasHeader = true, 
  hasSidebar = true,
  contentType = 'dashboard'
}) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      {hasHeader && (
        <Box sx={{ 
          height: 64, 
          bgcolor: 'background.paper', 
          borderBottom: '1px solid', 
          borderColor: 'divider',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 1 }} data-testid="skeleton-logo" />
            <Skeleton variant="text" width={200} height={24} data-testid="skeleton-header-title" />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Skeleton variant="circular" width={32} height={32} data-testid="skeleton-header-action" />
            <Skeleton variant="circular" width={32} height={32} data-testid="skeleton-header-action" />
          </Stack>
        </Box>
      )}
      
      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Sidebar */}
        {hasSidebar && (
          <Box sx={{ 
            width: 280, 
            bgcolor: 'background.paper', 
            borderRight: '1px solid', 
            borderColor: 'divider',
            p: 2
          }}>
            <Stack spacing={2}>
              {/* Navigation items */}
              {Array.from({ length: 8 }).map((_, index) => (
                <Stack key={index} direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="rectangular" width={20} height={20} sx={{ borderRadius: 0.5 }} data-testid="skeleton-nav-icon" />
                  <Skeleton variant="text" width="70%" height={20} data-testid="skeleton-nav-text" />
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
        
        {/* Main Content */}
        <Box sx={{ flex: 1, p: 3 }}>
          {contentType === 'dashboard' && <DashboardMetricsSkeleton />}
          {contentType === 'table' && <DataTableSkeleton hasSearch hasFilters />}
          {contentType === 'form' && <FormSkeleton />}
          {contentType === 'chart' && (
            <Stack spacing={3}>
              <ChartSkeleton height={400} />
              <ChartSkeleton height={300} />
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// Admin Section Skeleton - Generic skeleton for admin sections
export const AdminSectionSkeleton: React.FC = () => {
  return (
    <SkeletonContainer>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width="30%" height={32} />
        </Stack>
        
        {/* Content cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index}>
              <CardContent>
                <Stack spacing={2}>
                  <Skeleton variant="text" width="60%" height={24} />
                  <Skeleton variant="rectangular" width="100%" height={120} />
                  <Stack direction="row" spacing={1}>
                    <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                    <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                  </Stack>
                </Stack>
              </CardContent>
            </SkeletonCard>
          ))}
        </Box>
        
        {/* Table skeleton */}
        <DataTableSkeleton rows={5} hasHeader hasSearch />
      </Stack>
    </SkeletonContainer>
  );
};

export default {
  DashboardMetricsSkeleton,
  DataTableSkeleton,
  ChartSkeleton,
  ListSkeleton,
  FormSkeleton,
  PageSkeleton,
  AdminSection: AdminSectionSkeleton,
};