import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Snackbar,
  Card,
  CardContent,
  FormControlLabel,
  Switch,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Share as ShareIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
import { useNotifications } from '../../hooks/useNotifications';
import { debugLog } from './DebugPanel';
import { useAuth } from '../../context/AuthContext';

interface ShareSettings {
  includeAnalytics: boolean;
  includeForecasts: boolean;
}

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  chartTitle: string;
  chartType?: string;
  shopName?: string;
  metrics?: {
    revenue?: number;
    orders?: number;
    conversion?: number;
    timeRange?: string;
    forecastPeriod?: string;
    forecastRevenue?: number;
    forecastOrders?: number;
    confidenceScore?: number;
  };
}

// Brand icons for Slack & Teams
const SlackLogoIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 122.8 122.8">
    <path d="M30.6 78.6c0 8.5-6.9 15.4-15.4 15.4S0 87.1 0 78.6s6.9-15.4 15.4-15.4h15.2v15.4z" fill="#e01e5a"/>
    <path d="M38.2 78.6c0-8.5 6.9-15.4 15.4-15.4s15.4 6.9 15.4 15.4v38.8c0 8.5-6.9 15.4-15.4 15.4-8.5 0-15.4-6.9-15.4-15.4l0.1-38.8z" fill="#e01e5a"/>
    <path d="M44.8 30.6c-8.5 0-15.4-6.9-15.4-15.4S36.3 0 44.8 0s15.4 6.9 15.4 15.4v15.2H44.8z" fill="#36c5f0"/>
    <path d="M44.8 38.2c8.5 0 15.4 6.9 15.4 15.4s-6.9 15.4-15.4 15.4H6.1C-2.4 69-9.3 62.1-9.3 53.6c0-8.5 6.9-15.4 15.4-15.4h38.7z" fill="#36c5f0"/>
    <path d="M92.2 44.2c0-8.5 6.9-15.4 15.4-15.4s15.4 6.9 15.4 15.4-6.9 15.4-15.4 15.4H92.2V44.2z" fill="#2eb67d"/>
    <path d="M84.6 44.2c0 8.5-6.9 15.4-15.4 15.4S53.8 52.7 53.8 44.2V5.5C53.8-3 60.7-9.9 69.2-9.9s15.4 6.9 15.4 15.4v38.7z" fill="#2eb67d"/>
    <path d="M78 92.2c8.5 0 15.4 6.9 15.4 15.4s-6.9 15.4-15.4 15.4-15.4-6.9-15.4-15.4V92.2H78z" fill="#ecb22e"/>
    <path d="M78 84.6c-8.5 0-15.4-6.9-15.4-15.4s6.9-15.4 15.4-15.4h38.8c8.5 0 15.4 6.9 15.4 15.4 0 8.5-6.9 15.4-15.4 15.4H78z" fill="#ecb22e"/>
  </SvgIcon>
);

const TeamsLogoIcon = (props: any) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path fill="#5059C9" d="M15.75 3.5h4.5A.75.75 0 0121 4.25v9.5a.75.75 0 01-.75.75h-4.5A.75.75 0 0115 13.75v-9.5a.75.75 0 01.75-.75z"/>
    <path fill="#7B83EB" d="M13 8.5h3v11.25A2.25 2.25 0 0113.75 22H4.25A2.25 2.25 0 012 19.75V8.5h3v6.25c0 .414.336.75.75.75h7.5c.414 0 .75-.336.75-.75V8.5z"/>
    <path fill="#5059C9" d="M17 4a2 2 0 100 4 2 2 0 000-4zM6.5 4A2.5 2.5 0 104 6.5 2.5 2.5 0 006.5 4z"/>
  </SvgIcon>
);

const ShareModal: React.FC<ShareModalProps> = ({
  open,
  onClose,
  chartTitle,
  chartType = 'chart',
  shopName,
  metrics,
}) => {
  const theme = useTheme();
  const { showInfo, showSuccess, showError } = useNotifications();
  const { shop } = useAuth();
  
  // State management
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    includeAnalytics: true,
    includeForecasts: true,
  });

  // Enhanced social sharing with relevant messages
  const handleSocialShare = useCallback(async (platform: string) => {
    const createRelevantMessage = (platform: string) => {
      const storeName = shopName || 'Our Store';
      const currentChart = chartTitle.toLowerCase();
      
      // Create chart-specific messaging
      let chartContext = '';
      if (currentChart.includes('revenue')) {
        chartContext = metrics?.revenue ? 
          `💰 Revenue insights: $${metrics.revenue.toLocaleString()}` : 
          '💰 Revenue performance insights';
      } else if (currentChart.includes('order')) {
        chartContext = metrics?.orders ? 
          `📦 Order analytics: ${metrics.orders.toLocaleString()} orders` : 
          '📦 Order performance analytics';
      } else if (currentChart.includes('conversion')) {
        chartContext = metrics?.conversion ? 
          `🎯 Conversion analysis: ${(metrics.conversion * 100).toFixed(2)}% rate` : 
          '🎯 Conversion rate analysis';
      } else {
        chartContext = '📊 Business performance insights';
      }
      
      const timeRange = metrics?.timeRange || 'recent period';
      const forecastText = metrics?.forecastPeriod && metrics?.forecastRevenue ? 
        `\n🔮 AI Forecast (${metrics.forecastPeriod}): $${metrics.forecastRevenue.toLocaleString()}${metrics.confidenceScore ? ` (${Math.round(metrics.confidenceScore * 100)}% confidence)` : ''}` : '';
      
      const baseMessage = `🚀 ${storeName} ${chartContext}`;
      const analyticsText = shareSettings.includeAnalytics ? `\n📈 Period: ${timeRange}` : '';
      const forecastTextToInclude = shareSettings.includeForecasts ? forecastText : '';
      
      return `${baseMessage}${analyticsText}${forecastTextToInclude}\n\n🌐 Powered by ShopGauge: https://www.shopgaugeai.com`;
    };

    try {
      showInfo('Preparing your share...');
      
      const enhancedMessage = createRelevantMessage(platform);
      
      switch (platform) {
        case 'linkedin': {
          const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://www.shopgaugeai.com')}&title=${encodeURIComponent(chartTitle)}&summary=${encodeURIComponent(enhancedMessage)}`;
          window.open(linkedInUrl, '_blank', 'width=600,height=400');
          break;
        }
          
        case 'twitter': {
          const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(enhancedMessage)}&url=${encodeURIComponent('https://www.shopgaugeai.com')}`;
          window.open(twitterUrl, '_blank', 'width=600,height=400');
          break;
        }
          
        case 'email': {
          const emailSubject = encodeURIComponent(`${chartTitle} - ${shopName || 'Analytics'} Insights`);
          const emailBody = encodeURIComponent(enhancedMessage);
          window.location.href = `mailto:?subject=${emailSubject}&body=${emailBody}`;
          break;
        }
          
        case 'slack':
          // Copy formatted message to clipboard for Slack
          await navigator.clipboard.writeText(enhancedMessage);
          setCopiedToClipboard(true);
          showSuccess('Message copied! Paste into Slack');
          setTimeout(() => setCopiedToClipboard(false), 3000);
          break;
          
        case 'teams':
          // Copy formatted message to clipboard for Teams
          await navigator.clipboard.writeText(enhancedMessage);
          setCopiedToClipboard(true);
          showSuccess('Message copied! Paste into Teams');
          setTimeout(() => setCopiedToClipboard(false), 3000);
          break;
          
        case 'copy':
          await navigator.clipboard.writeText(enhancedMessage);
          setCopiedToClipboard(true);
          showSuccess('Message copied to clipboard!');
          setTimeout(() => setCopiedToClipboard(false), 3000);
          break;
          
        default:
          showError('Unsupported platform');
          return;
      }
      
      // Log audit event
      await logAuditEvent('share', platform, { 
        chartTitle, 
        chartType, 
        messageLength: enhancedMessage.length 
      });
      
    } catch (error) {
      debugLog.error('Sharing failed:', error, 'ShareModal');
      showError('Sharing operation failed. Please verify permissions and try again.');
    }
  }, [shopName, chartTitle, chartType, metrics, shareSettings, showInfo, showSuccess, showError]);

  // Audit logging function
  const logAuditEvent = useCallback(async (action: string, type: string, details: any) => {
    try {
      // Log locally for debugging
      debugLog.info(`Audit: ${action}_${type}`, { 
        shop: shop || shopName,
        timestamp: new Date().toISOString(),
        ...details 
      }, 'ShareModal');
      
      // Call the backend audit API
      const response = await fetch('/api/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({
          action,
          type,
          details: {
            shop: shop || shopName,
            timestamp: new Date().toISOString(),
            ...details
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Audit API responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      debugLog.info('Audit logged successfully', result, 'ShareModal');
      
    } catch (error) {
      debugLog.error('Failed to log audit event:', error, 'ShareModal');
      // Don't fail the main operation if audit logging fails
    }
  }, [shop, shopName]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #2563eb 0%, #9333ea 100%)',
          color: 'white',
          borderRadius: '8px 8px 0 0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShareIcon sx={{ mr: 1.5, fontSize: 28 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Share Chart
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  {chartTitle} • {shopName || 'Analytics Dashboard'}
                </Typography>
              </Box>
            </Box>
            <IconButton 
              onClick={onClose} 
              size="small"
              sx={{ 
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {/* Social Sharing Grid */}
          <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
            Share on Social Media
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 4 }}>
            {[
              { 
                platform: 'linkedin', 
                icon: LinkedInIcon, 
                title: 'LinkedIn', 
                color: '#0077b5',
                desc: 'Professional network'
              },
              { 
                platform: 'twitter', 
                icon: TwitterIcon, 
                title: 'Twitter/X', 
                color: '#1da1f2',
                desc: 'Social media'
              },
              { 
                platform: 'email', 
                icon: EmailIcon, 
                title: 'Email', 
                color: '#ea4335',
                desc: 'Direct message'
              },
              { 
                platform: 'slack', 
                icon: SlackLogoIcon, 
                title: 'Slack', 
                color: '#4a154b',
                desc: 'Team chat'
              },
              { 
                platform: 'teams', 
                icon: TeamsLogoIcon, 
                title: 'Teams', 
                color: '#6264a7',
                desc: 'Microsoft Teams'
              },
              { 
                platform: 'copy', 
                icon: ContentCopyIcon, 
                title: 'Copy Link', 
                color: '#6b7280',
                desc: 'Copy to clipboard'
              }
            ].map((item) => (
              <Card 
                key={item.platform}
                sx={{ 
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { 
                    borderColor: item.color,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 12px ${item.color}40`
                  },
                  transition: 'all 0.2s ease'
                }}
                onClick={() => handleSocialShare(item.platform)}
              >
                <CardContent sx={{ textAlign: 'center', p: 2 }}>
                  <item.icon sx={{ 
                    fontSize: 32, 
                    color: item.color, 
                    mb: 1 
                  }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.desc}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Share Settings */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Share Settings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={shareSettings.includeAnalytics}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, includeAnalytics: e.target.checked }))}
                    />
                  }
                  label="Include analytics data in message"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={shareSettings.includeForecasts}
                      onChange={(e) => setShareSettings(prev => ({ ...prev, includeForecasts: e.target.checked }))}
                    />
                  }
                  label="Include AI forecasts in message"
                />
              </Box>
            </CardContent>
          </Card>
        </DialogContent>

        <DialogActions sx={{ 
          px: 3, 
          py: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'grey.50',
          justifyContent: 'space-between'
        }}>
          <Button 
            onClick={onClose} 
            variant="outlined"
            color="inherit"
            sx={{ minWidth: 100 }}
          >
            Close
          </Button>
          
          <Typography variant="body2" color="text.secondary">
            Select a platform above to share your insights
          </Typography>
        </DialogActions>
      </Dialog>

      {/* Success notification */}
      <Snackbar
        open={copiedToClipboard}
        autoHideDuration={3000}
        onClose={() => setCopiedToClipboard(false)}
        message="Copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default ShareModal; 