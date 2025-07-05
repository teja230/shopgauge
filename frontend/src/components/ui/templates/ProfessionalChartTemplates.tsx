import React from 'react';
import { Box, Typography, Paper, useTheme, alpha } from '@mui/material';
import { 
  TrendingUp, 
  Business, 
  Analytics, 
  AutoAwesome,
  Timeline,
  BarChart,
  ShowChart,
} from '@mui/icons-material';

interface TemplateProps {
  title: string;
  shopName: string;
  chartComponent: React.ReactNode;
  metrics?: {
    revenue?: number;
    orders?: number;
    conversion?: number;
    timeRange?: string;
  };
  showWatermark?: boolean;
  companyLogo?: string;
  brandColors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

// Executive Summary Template
export const ExecutiveSummaryTemplate: React.FC<TemplateProps> = ({
  title,
  shopName,
  chartComponent,
  metrics,
  showWatermark = true,
  companyLogo,
  brandColors,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3,
        borderBottom: `2px solid ${brandColors?.primary || theme.palette.primary.main}`,
        pb: 2,
      }}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="text.primary">
            {title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5 }}>
            {shopName} • Executive Summary
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Business sx={{ fontSize: 32, color: brandColors?.primary || theme.palette.primary.main }} />
          {companyLogo && (
            <img 
              src={companyLogo} 
              alt="Company Logo" 
              style={{ height: 32, objectFit: 'contain' }}
            />
          )}
        </Box>
      </Box>

      {/* Key Metrics */}
      {metrics && (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 2,
          mb: 3,
        }}>
          {metrics.revenue && (
            <Box sx={{ 
              p: 2, 
              backgroundColor: alpha(brandColors?.primary || theme.palette.primary.main, 0.1),
              borderRadius: 1,
              textAlign: 'center',
            }}>
              <Typography variant="h5" fontWeight={600} color="primary.main">
                ${metrics.revenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Revenue
              </Typography>
            </Box>
          )}
          {metrics.orders && (
            <Box sx={{ 
              p: 2, 
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              borderRadius: 1,
              textAlign: 'center',
            }}>
              <Typography variant="h5" fontWeight={600} color="success.main">
                {metrics.orders.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Orders
              </Typography>
            </Box>
          )}
          {metrics.conversion && (
            <Box sx={{ 
              p: 2, 
              backgroundColor: alpha(theme.palette.warning.main, 0.1),
              borderRadius: 1,
              textAlign: 'center',
            }}>
              <Typography variant="h5" fontWeight={600} color="warning.main">
                {metrics.conversion.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Conversion Rate
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ 
        flex: 1,
        backgroundColor: '#fafafa',
        borderRadius: 1,
        p: 2,
        border: `1px solid ${theme.palette.divider}`,
      }}>
        {chartComponent}
      </Box>

      {/* Footer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 3,
        pt: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="body2" color="text.secondary">
          Generated on {new Date().toLocaleDateString()}
        </Typography>
        {showWatermark && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Powered by
            </Typography>
            <Typography variant="body2" color="primary.main" fontWeight={600}>
              StoresightAI
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

// Social Media Template
export const SocialCelebrationTemplate: React.FC<TemplateProps> = ({
  title,
  shopName,
  chartComponent,
  metrics,
  showWatermark = true,
  brandColors,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: brandColors?.primary 
          ? `linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.secondary || brandColors.primary} 100%)`
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        minHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        color: 'white',
      }}
    >
      {/* Celebration Header */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
          🎉 {shopName}
        </Typography>
        <Typography variant="h5" fontWeight={500}>
          {title}
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 1, opacity: 0.9 }}>
          Celebrating our success together!
        </Typography>
      </Box>

      {/* Key Achievement */}
      {metrics && (
        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: 3,
          mb: 3,
        }}>
          {metrics.revenue && (
            <Box sx={{ 
              p: 2,
              backgroundColor: alpha('#ffffff', 0.2),
              borderRadius: 2,
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <TrendingUp sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                ${metrics.revenue.toLocaleString()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Revenue Growth
              </Typography>
            </Box>
          )}
          {metrics.orders && (
            <Box sx={{ 
              p: 2,
              backgroundColor: alpha('#ffffff', 0.2),
              borderRadius: 2,
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <BarChart sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" fontWeight={600}>
                {metrics.orders.toLocaleString()}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Orders Processed
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ 
        flex: 1,
        backgroundColor: alpha('#ffffff', 0.95),
        borderRadius: 2,
        p: 2,
        color: 'text.primary',
      }}>
        {chartComponent}
      </Box>

      {/* Social Footer */}
      <Box sx={{ 
        textAlign: 'center',
        mt: 2,
      }}>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          #Success #Growth #DataDriven #TeamWork
        </Typography>
        {showWatermark && (
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
            Powered by StoresightAI
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// Investor Update Template
export const InvestorUpdateTemplate: React.FC<TemplateProps> = ({
  title,
  shopName,
  chartComponent,
  metrics,
  showWatermark = true,
  brandColors,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        minHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Professional Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2,
      }}>
        <Box>
          <Typography variant="h5" fontWeight={600} color="text.primary">
            {shopName}
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Investor Update
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            Period: {metrics?.timeRange || '30d'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date().toLocaleDateString()}
          </Typography>
        </Box>
      </Box>

      {/* Performance Metrics */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 1,
        mb: 3,
        p: 2,
        backgroundColor: '#f8f9fa',
        borderRadius: 1,
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={600} color="primary.main">
            {metrics?.revenue ? `$${metrics.revenue.toLocaleString()}` : 'N/A'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Revenue
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={600} color="success.main">
            {metrics?.orders ? metrics.orders.toLocaleString() : 'N/A'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Orders
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={600} color="warning.main">
            {metrics?.conversion ? `${metrics.conversion.toFixed(1)}%` : 'N/A'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Conversion
          </Typography>
        </Box>
      </Box>

      {/* Chart Title */}
      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        {title}
      </Typography>

      {/* Chart */}
      <Box sx={{ 
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 1,
        p: 1,
        border: `1px solid ${theme.palette.divider}`,
      }}>
        {chartComponent}
      </Box>

      {/* Professional Footer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 2,
        pt: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="body2" color="text.secondary">
          Confidential - For Investor Use Only
        </Typography>
        {showWatermark && (
          <Typography variant="body2" color="text.secondary">
            Analytics by StoresightAI
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// Marketing Insights Template
export const MarketingInsightsTemplate: React.FC<TemplateProps> = ({
  title,
  shopName,
  chartComponent,
  metrics,
  showWatermark = true,
  brandColors,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        minHeight: 600,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Marketing Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        mb: 3,
        p: 2,
        backgroundColor: alpha(brandColors?.primary || theme.palette.primary.main, 0.1),
        borderRadius: 1,
      }}>
        <Analytics sx={{ 
          fontSize: 32, 
          color: brandColors?.primary || theme.palette.primary.main,
          mr: 2,
        }} />
        <Box>
          <Typography variant="h5" fontWeight={600} color="text.primary">
            {title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {shopName} • Marketing Analytics
          </Typography>
        </Box>
      </Box>

      {/* Key Insights */}
      <Box sx={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 2,
        mb: 3,
      }}>
        {metrics?.revenue && (
          <Box sx={{ 
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            borderLeft: `4px solid ${brandColors?.primary || theme.palette.primary.main}`,
          }}>
            <Typography variant="h6" fontWeight={600} color="primary.main">
              ${metrics.revenue.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Revenue Generated
            </Typography>
            <Typography variant="caption" color="success.main">
              ↗ Strong performance
            </Typography>
          </Box>
        )}
        {metrics?.orders && (
          <Box sx={{ 
            p: 2,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            borderLeft: `4px solid ${theme.palette.success.main}`,
          }}>
            <Typography variant="h6" fontWeight={600} color="success.main">
              {metrics.orders.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Orders Processed
            </Typography>
            <Typography variant="caption" color="success.main">
              ↗ Healthy conversion
            </Typography>
          </Box>
        )}
      </Box>

      {/* Chart */}
      <Box sx={{ 
        flex: 1,
        backgroundColor: '#fafafa',
        borderRadius: 1,
        p: 2,
        border: `1px solid ${theme.palette.divider}`,
      }}>
        {chartComponent}
      </Box>

      {/* Actionable Insights */}
      <Box sx={{ 
        mt: 3,
        p: 2,
        backgroundColor: alpha(theme.palette.info.main, 0.1),
        borderRadius: 1,
        borderLeft: `4px solid ${theme.palette.info.main}`,
      }}>
        <Typography variant="subtitle2" fontWeight={600} color="info.main" sx={{ mb: 1 }}>
          Key Takeaways
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Data-driven insights enabling strategic marketing decisions and optimized performance.
        </Typography>
      </Box>

      {/* Footer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 2,
        pt: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="body2" color="text.secondary">
          Marketing Intelligence • {new Date().toLocaleDateString()}
        </Typography>
        {showWatermark && (
          <Typography variant="body2" color="text.secondary">
            Powered by StoresightAI
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// Minimal Professional Template
export const MinimalProfessionalTemplate: React.FC<TemplateProps> = ({
  title,
  shopName,
  chartComponent,
  metrics,
  showWatermark = true,
  brandColors,
}) => {
  const theme = useTheme();
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        minHeight: 500,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Clean Header */}
      <Box sx={{ 
        textAlign: 'center',
        mb: 3,
        pb: 2,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="h5" fontWeight={600} color="text.primary">
          {shopName}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
          {title}
        </Typography>
      </Box>

      {/* Chart */}
      <Box sx={{ 
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 1,
        p: 1,
      }}>
        {chartComponent}
      </Box>

      {/* Simple Footer */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 2,
        pt: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString()}
        </Typography>
        {showWatermark && (
          <Typography variant="body2" color="text.secondary">
            StoresightAI
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

// Template registry
export const PROFESSIONAL_TEMPLATES = {
  'executive-summary': ExecutiveSummaryTemplate,
  'social-celebration': SocialCelebrationTemplate,
  'investor-update': InvestorUpdateTemplate,
  'marketing-insights': MarketingInsightsTemplate,
  'minimal-professional': MinimalProfessionalTemplate,
};

// Template selector component
export const TemplateRenderer: React.FC<{
  templateId: string;
  props: TemplateProps;
}> = ({ templateId, props }) => {
  const TemplateComponent = PROFESSIONAL_TEMPLATES[templateId as keyof typeof PROFESSIONAL_TEMPLATES];
  
  if (!TemplateComponent) {
    return <MinimalProfessionalTemplate {...props} />;
  }
  
  return <TemplateComponent {...props} />;
}; 