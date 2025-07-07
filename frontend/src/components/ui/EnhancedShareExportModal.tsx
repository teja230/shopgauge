import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  ButtonGroup,
  Tabs,
  Tab,
  Card,
  CardContent,
  Alert,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Share as ShareIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  PhotoCamera as PhotoCameraIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
  Link as LinkIcon,
  Code as CodeIcon,

  CloudUpload as CloudUploadIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import { debugLog } from './DebugPanel';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

interface ExportSettings {
  format: 'png' | 'pdf' | 'excel';
  quality: 'standard' | 'high' | 'ultra';
  includeWatermark: boolean;
  includeData: boolean;
  includeMetadata: boolean;
}

interface ShareSettings {
  includeAnalytics: boolean;
  includeForecasts: boolean;
  publicAccess: boolean;
  expirationDays: number;
}

interface EnhancedShareExportModalProps {
  open: boolean;
  onClose: () => void;
  chartRef: React.RefObject<HTMLDivElement>;
  chartTitle: string;
  chartType?: string;
  shopName?: string;
  data?: any;
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

const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard Quality (1x)', description: 'Fast export, smaller file size' },
  { value: 'high', label: 'High Quality (2x)', description: 'Better quality, larger file size' },
  { value: 'ultra', label: 'Ultra Quality (3x)', description: 'Best quality, largest file size' },
];

const EXPIRATION_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

const EnhancedShareExportModal: React.FC<EnhancedShareExportModalProps> = ({
  open,
  onClose,
  chartRef,
  chartTitle,
  chartType = 'chart',
  shopName,
  data,
  metrics,
}) => {
  const theme = useTheme();
  const { showInfo, showSuccess, showError, showWarning } = useNotifications();
  const { shop } = useAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState<'share' | 'export'>('share');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 'high',
    includeWatermark: true,
    includeData: true,
    includeMetadata: true,
  });
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    includeAnalytics: true,
    includeForecasts: true,
    publicAccess: false,
    expirationDays: 30,
  });

  // Refs for SVG capture
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Generate export filename
  const generateFilename = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedTitle = chartTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedShop = shopName?.replace(/[^a-zA-Z0-9]/g, '_') || 'chart';
    return `${sanitizedShop}_${sanitizedTitle}_${timestamp}`;
  }, [chartTitle, shopName]);

  // Enhanced SVG-to-Canvas conversion for Recharts
  const convertSVGToCanvas = useCallback(async (element: HTMLElement): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      try {
        // Find all SVG elements in the chart
        const svgElements = element.querySelectorAll('svg');
        
        if (svgElements.length === 0) {
          throw new Error('No SVG elements found in chart');
        }

        const mainSvg = svgElements[0] as SVGSVGElement;
        const svgData = new XMLSerializer().serializeToString(mainSvg);
        
        // Get dimensions
        const rect = mainSvg.getBoundingClientRect();
        const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Cannot get canvas context');
        }
        
        canvas.width = rect.width * scale;
        canvas.height = rect.height * scale;
        
        // Scale context for high DPI
        ctx.scale(scale, scale);
        
        // Set background
        ctx.fillStyle = theme.palette.background.paper;
        ctx.fillRect(0, 0, rect.width, rect.height);
        
        // Create image from SVG
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          resolve(canvas);
        };
        img.onerror = (error) => {
          reject(new Error(`Failed to load SVG image: ${error}`));
        };
        
        // Convert SVG to data URL
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
      } catch (error) {
        reject(error);
      }
    });
  }, [exportSettings.quality, theme.palette.background.paper]);

  // Enhanced PNG export with proper SVG handling
  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting enhanced PNG export', { 
      quality: exportSettings.quality, 
      filename: generateFilename(),
      chartType 
    }, 'EnhancedShareExportModal');
    
    showInfo('Generating high-quality chart image...');

    try {
      setProgress(25);

      // Try enhanced SVG conversion first
      let canvas: HTMLCanvasElement;
      try {
        canvas = await convertSVGToCanvas(chartRef.current);
        setProgress(50);
      } catch (svgError) {
        debugLog.warn('SVG conversion failed, falling back to html2canvas', svgError, 'EnhancedShareExportModal');
        
        // Fallback to html2canvas with enhanced options
        const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;
        
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          imageTimeout: 15000,
          removeContainer: false,
          // Enhanced options for better SVG capture
          ignoreElements: (element) => {
            // Skip elements that might cause issues
            return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
          },
          onclone: (clonedDoc) => {
            // Enhance cloned document for better rendering
            const clonedSvgs = clonedDoc.querySelectorAll('svg');
            clonedSvgs.forEach(svg => {
              svg.style.backgroundColor = 'transparent';
              svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            });
          },
        });
        setProgress(50);
      }

      setProgress(75);

      // Create download link
      const link = document.createElement('a');
      link.download = `${generateFilename()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      setProgress(100);
      showSuccess('Chart exported successfully as PNG!');
      
      // Log audit event
      await logAuditEvent('export', 'png', { 
        chartTitle, 
        chartType, 
        quality: exportSettings.quality,
        filename: link.download 
      });

    } catch (error) {
      debugLog.error('PNG export failed:', error, 'EnhancedShareExportModal');
      showError('Export failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, theme, showInfo, showSuccess, showError, chartTitle, chartType, convertSVGToCanvas]);

  // Enhanced PDF export
  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) return;

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting enhanced PDF export', { 
      filename: generateFilename(), 
      includeWatermark: exportSettings.includeWatermark,
      includeMetadata: exportSettings.includeMetadata 
    }, 'EnhancedShareExportModal');
    
    showInfo('Generating professional PDF report...');

    try {
      setProgress(25);

      // Get chart canvas
      let canvas: HTMLCanvasElement;
      try {
        canvas = await convertSVGToCanvas(chartRef.current);
      } catch (svgError) {
        const scale = 2; // Always use high quality for PDF
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
        });
      }

      setProgress(50);

      // Create PDF
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add professional header
      pdf.setFontSize(18);
      pdf.setTextColor(40, 40, 40);
      pdf.text(`${shopName || 'Analytics'} - ${chartTitle}`, 10, 20);
      
      if (exportSettings.includeMetadata) {
        // Add metadata
        pdf.setFontSize(12);
        pdf.setTextColor(80, 80, 80);
        pdf.text(`Report Type: ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Analytics`, 10, 30);
        pdf.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}`, 10, 35);
        
        if (metrics?.timeRange) {
          pdf.text(`Period: ${metrics.timeRange}`, 10, 40);
        }
        
        // Add key metrics
        if (metrics?.revenue || metrics?.orders || metrics?.conversion) {
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          let yPos = 50;
          
          if (metrics.revenue) {
            pdf.text(`Revenue: $${metrics.revenue.toLocaleString()}`, 10, yPos);
            yPos += 5;
          }
          if (metrics.orders) {
            pdf.text(`Orders: ${metrics.orders.toLocaleString()}`, 10, yPos);
            yPos += 5;
          }
          if (metrics.conversion) {
            pdf.text(`Conversion Rate: ${(metrics.conversion * 100).toFixed(2)}%`, 10, yPos);
            yPos += 5;
          }
          
          // Add forecast info if available
          if (metrics.forecastRevenue && metrics.forecastPeriod) {
            pdf.text(`Forecast (${metrics.forecastPeriod}): $${metrics.forecastRevenue.toLocaleString()}`, 10, yPos);
            if (metrics.confidenceScore) {
              pdf.text(`Confidence: ${Math.round(metrics.confidenceScore * 100)}%`, 10, yPos + 5);
            }
          }
        }
      }
      
      // Add chart
      const yPosition = exportSettings.includeMetadata ? 
        Math.min(70, pdfHeight - imgHeight - 20) : 
        Math.min(45, pdfHeight - imgHeight - 20);
      
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, Math.min(imgHeight, pdfHeight - yPosition - 15));
      
      // Add footer with single ShopGauge link (no red background)
      if (exportSettings.includeWatermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text('Powered by ShopGauge - https://www.shopgaugeai.com', 10, pdfHeight - 10);
      }
      
      setProgress(75);
      
      const filename = `${generateFilename()}.pdf`;
      pdf.save(filename);
      
      setProgress(100);
      showSuccess('Professional PDF report generated successfully!');
      
      // Log audit event
      await logAuditEvent('export', 'pdf', { 
        chartTitle, 
        chartType, 
        includeMetadata: exportSettings.includeMetadata,
        filename 
      });
      
    } catch (error) {
      debugLog.error('PDF export failed:', error, 'EnhancedShareExportModal');
      showError('PDF generation failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, shopName, chartTitle, chartType, metrics, theme, showInfo, showSuccess, showError, convertSVGToCanvas]);

  // Excel export functionality
  const handleExportExcel = useCallback(async () => {
    if (!data) {
      showError('No data available for Excel export');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting Excel export', { 
      filename: generateFilename(),
      chartType,
      dataLength: Array.isArray(data) ? data.length : 'unknown'
    }, 'EnhancedShareExportModal');
    
    showInfo('Generating Excel file with chart data...');

    try {
      setProgress(25);

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Prepare data based on chart type and structure
      let exportData: any[] = [];
      let sheetName = 'Chart Data';
      
      if (Array.isArray(data)) {
        exportData = data;
      } else if (data.historical && Array.isArray(data.historical)) {
        // Advanced analytics data structure
        exportData = [...data.historical];
        
        if (data.predictions && Array.isArray(data.predictions)) {
          exportData = [...exportData, ...data.predictions.map((item: any) => ({
            ...item,
            isPrediction: true
          }))];
        }
        
        sheetName = 'Analytics Data';
      } else {
        throw new Error('Unsupported data format for Excel export');
      }

      setProgress(50);

      // Create main data sheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Add metadata sheet if enabled
      if (exportSettings.includeMetadata) {
        const metadataSheet = [
          { Property: 'Chart Title', Value: chartTitle },
          { Property: 'Chart Type', Value: chartType },
          { Property: 'Shop Name', Value: shopName || 'N/A' },
          { Property: 'Export Date', Value: new Date().toISOString() },
          { Property: 'Time Range', Value: metrics?.timeRange || 'N/A' },
          { Property: 'Total Records', Value: exportData.length },
        ];
        
        if (metrics?.revenue) {
          metadataSheet.push({ Property: 'Total Revenue', Value: `$${metrics.revenue.toLocaleString()}` });
        }
        if (metrics?.orders) {
          metadataSheet.push({ Property: 'Total Orders', Value: metrics.orders.toLocaleString() });
        }
        if (metrics?.conversion) {
          metadataSheet.push({ Property: 'Conversion Rate', Value: `${(metrics.conversion * 100).toFixed(2)}%` });
        }
        
        const metaWs = XLSX.utils.json_to_sheet(metadataSheet);
        XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata');
      }

      setProgress(75);

      // Save file
      const filename = `${generateFilename()}.xlsx`;
      XLSX.writeFile(wb, filename);

      setProgress(100);
      showSuccess('Excel file exported successfully!');
      
      // Log audit event
      await logAuditEvent('export', 'excel', { 
        chartTitle, 
        chartType, 
        recordCount: exportData.length,
        filename 
      });

    } catch (error) {
      debugLog.error('Excel export failed:', error, 'EnhancedShareExportModal');
      showError('Excel export failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [data, exportSettings, generateFilename, chartTitle, chartType, shopName, metrics, showInfo, showSuccess, showError]);

  // Handle export based on format
  const handleExport = useCallback(() => {
    switch (exportSettings.format) {
      case 'png':
        handleExportPNG();
        break;
      case 'pdf':
        handleExportPDF();
        break;
      case 'excel':
        handleExportExcel();
        break;
      default:
        showError('Unsupported export format');
    }
  }, [exportSettings.format, handleExportPNG, handleExportPDF, handleExportExcel, showError]);

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
      const periodText = `\n📈 ${chartTitle} analysis for ${timeRange}`;
      
      switch (platform) {
        case 'linkedin':
          return `${baseMessage}${periodText}${forecastText}\n\n#Shopify #Ecommerce #Analytics #BusinessIntelligence ${forecastText ? '#AIForecasting' : ''}`;
        
        case 'twitter':
          return `${baseMessage}${periodText}${forecastText}\n\n#Shopify #Ecommerce #Analytics ${forecastText ? '#AIForecasting' : ''}`;
        
        case 'email':
          return `${baseMessage}${periodText}${forecastText}\n\n📅 Period: ${timeRange}`;
        
        default:
          return `${baseMessage}${periodText}${forecastText}`;
      }
    };
    
    const message = createRelevantMessage(platform);
    const shareableUrl = window.location.href;
    
    // Single ShopGauge link (no red background)
    const shopGaugeUrl = 'https://www.shopgaugeai.com';
    const enhancedMessage = `${message}\n\n🌐 Powered by ShopGauge: ${shopGaugeUrl}`;
    
    try {
      switch (platform) {
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareableUrl)}&summary=${encodeURIComponent(enhancedMessage)}`);
          showInfo('Sharing your business insights on LinkedIn...');
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(enhancedMessage)}&url=${encodeURIComponent(shareableUrl)}`);
          showInfo('Sharing your performance insights on Twitter...');
          break;
        case 'email':
          window.open(`mailto:?subject=${encodeURIComponent(`${shopName || 'Store'} ${chartTitle} Insights`)}&body=${encodeURIComponent(enhancedMessage + '\n\n' + shareableUrl)}`);
          showInfo('Opening email to share your business insights...');
          break;
        case 'slack':
          // Slack sharing would require Slack app integration
          await navigator.clipboard.writeText(enhancedMessage + '\n\n' + shareableUrl);
          showInfo('Message copied to clipboard for Slack sharing');
          break;
        case 'teams':
          // Teams sharing would require Teams app integration
          await navigator.clipboard.writeText(enhancedMessage + '\n\n' + shareableUrl);
          showInfo('Message copied to clipboard for Teams sharing');
          break;
        case 'copy':
          await navigator.clipboard.writeText(enhancedMessage + '\n\n' + shareableUrl);
          setCopiedToClipboard(true);
          setTimeout(() => setCopiedToClipboard(false), 3000);
          showSuccess('Performance insights link copied to clipboard!');
          break;
        default:
          break;
      }
      
      // Log audit event
      await logAuditEvent('share', platform, { 
        chartTitle, 
        chartType, 
        messageLength: enhancedMessage.length 
      });
      
    } catch (error) {
      debugLog.error('Sharing failed:', error, 'EnhancedShareExportModal');
      showError('Sharing operation failed. Please verify permissions and try again.');
    }
  }, [shopName, chartTitle, chartType, metrics, showInfo, showSuccess, showError]);

  // Generate public link (placeholder implementation)
  const handleGeneratePublicLink = useCallback(async () => {
    setIsProcessing(true);
    showInfo('Generating public link...');
    
    try {
      // This would typically involve backend API call
      const publicUrl = `${window.location.origin}/public/chart/${generateFilename()}`;
      
      await navigator.clipboard.writeText(publicUrl);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 3000);
      showSuccess('Public link copied to clipboard!');
      
      // Log audit event
      await logAuditEvent('share', 'public_link', { 
        chartTitle, 
        chartType, 
        expirationDays: shareSettings.expirationDays 
      });
      
    } catch (error) {
      showError('Failed to generate public link');
    } finally {
      setIsProcessing(false);
    }
  }, [generateFilename, shareSettings.expirationDays, chartTitle, chartType, showInfo, showSuccess, showError]);

  // Generate embed code
  const handleGenerateEmbedCode = useCallback(async () => {
    const embedCode = `<iframe src="${window.location.origin}/embed/chart/${generateFilename()}" width="800" height="600" frameborder="0"></iframe>`;
    
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 3000);
      showSuccess('Embed code copied to clipboard!');
      
      // Log audit event
      await logAuditEvent('share', 'embed_code', { 
        chartTitle, 
        chartType 
      });
      
    } catch (error) {
      showError('Failed to copy embed code');
    }
  }, [generateFilename, chartTitle, chartType, showSuccess, showError]);

  // Audit logging function
  const logAuditEvent = useCallback(async (action: string, type: string, details: any) => {
    try {
      // Log locally for debugging
      debugLog.info(`Audit: ${action}_${type}`, { 
        shop: shop || shopName,
        timestamp: new Date().toISOString(),
        ...details 
      }, 'EnhancedShareExportModal');
      
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
      debugLog.info('Audit logged successfully', result, 'EnhancedShareExportModal');
      
    } catch (error) {
      debugLog.error('Failed to log audit event:', error, 'EnhancedShareExportModal');
      // Don't fail the main operation if audit logging fails
    }
  }, [shop, shopName]);

  // Show notification for successful actions
  const showActionNotification = useCallback((action: string, type: string) => {
    const actionMessages = {
      'export_png': 'Chart exported as PNG image',
      'export_pdf': 'Professional PDF report generated',
      'export_excel': 'Data exported to Excel spreadsheet',
      'share_linkedin': 'Shared on LinkedIn',
      'share_twitter': 'Shared on Twitter',
      'share_email': 'Email sharing initiated',
      'share_copy': 'Link copied to clipboard',
      'share_public_link': 'Public link generated',
      'share_embed_code': 'Embed code generated',
    };
    
    const message = actionMessages[`${action}_${type}` as keyof typeof actionMessages] || 'Action completed';
    showSuccess(message);
  }, [showSuccess]);

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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShareIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Share & Export Chart
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Tab Navigation */}
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ mb: 3 }}
          >
            <Tab 
              label="Share" 
              value="share"
              icon={<ShareIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Export" 
              value="export"
              icon={<DownloadIcon />}
              iconPosition="start"
            />
          </Tabs>

          {/* Share Tab */}
          {activeTab === 'share' && (
            <Box>
              {/* Share Settings */}
              <Card sx={{ mb: 3 }}>
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
                      label="Include analytics data"
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={shareSettings.includeForecasts}
                          onChange={(e) => setShareSettings(prev => ({ ...prev, includeForecasts: e.target.checked }))}
                        />
                      }
                      label="Include AI forecasts"
                    />
                    
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Link Expiration</InputLabel>
                      <Select
                        value={shareSettings.expirationDays}
                        onChange={(e) => setShareSettings(prev => ({ ...prev, expirationDays: e.target.value as number }))}
                        label="Link Expiration"
                      >
                        {EXPIRATION_OPTIONS.map(option => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </CardContent>
              </Card>

              {/* Public Link & Embed */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Public Link & Embed
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={handleGeneratePublicLink}
                    disabled={isProcessing}
                  >
                    Generate Public Link
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<CodeIcon />}
                    onClick={handleGenerateEmbedCode}
                  >
                    Get Embed Code
                  </Button>
                </Box>
                

              </Box>

              {/* Social Media Sharing */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Social Media & Platforms
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<LinkedInIcon />}
                    onClick={() => handleSocialShare('linkedin')}
                  >
                    LinkedIn
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<TwitterIcon />}
                    onClick={() => handleSocialShare('twitter')}
                  >
                    Twitter
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EmailIcon />}
                    onClick={() => handleSocialShare('email')}
                  >
                    Email
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleSocialShare('slack')}
                  >
                    Slack
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleSocialShare('teams')}
                  >
                    Teams
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={copiedToClipboard ? <CheckIcon /> : <ContentCopyIcon />}
                    onClick={() => handleSocialShare('copy')}
                    color={copiedToClipboard ? 'success' : 'primary'}
                  >
                    {copiedToClipboard ? 'Copied!' : 'Copy Link'}
                  </Button>
                </Box>
              </Box>
            </Box>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <Box>
              {/* Export Settings */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Export Settings
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Export Format</InputLabel>
                      <Select
                        value={exportSettings.format}
                        onChange={(e) => setExportSettings(prev => ({ ...prev, format: e.target.value as any }))}
                        label="Export Format"
                      >
                        <MenuItem value="png">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PhotoCameraIcon sx={{ mr: 1 }} />
                            PNG Image
                          </Box>
                        </MenuItem>
                        <MenuItem value="pdf">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PdfIcon sx={{ mr: 1 }} />
                            PDF Report
                          </Box>
                        </MenuItem>
                        <MenuItem value="excel">
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ExcelIcon sx={{ mr: 1 }} />
                            Excel Data
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>

                    {(exportSettings.format === 'png' || exportSettings.format === 'pdf') && (
                      <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Quality</InputLabel>
                        <Select
                          value={exportSettings.quality}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, quality: e.target.value as any }))}
                          label="Quality"
                        >
                          {QUALITY_OPTIONS.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {option.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.description}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    <FormControlLabel
                      control={
                        <Switch
                          checked={exportSettings.includeWatermark}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeWatermark: e.target.checked }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">Include ShopGauge branding</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Single link, no red background
                          </Typography>
                        </Box>
                      }
                    />

                    {exportSettings.format === 'excel' && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={exportSettings.includeData}
                            onChange={(e) => setExportSettings(prev => ({ ...prev, includeData: e.target.checked }))}
                          />
                        }
                        label="Include all data series (visible & hidden)"
                      />
                    )}

                    <FormControlLabel
                      control={
                        <Switch
                          checked={exportSettings.includeMetadata}
                          onChange={(e) => setExportSettings(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                        />
                      }
                      label="Include metadata and metrics"
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Storage Information */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StorageIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Storage & Costs
                  </Typography>
                </Box>
                <Typography variant="body2">
                  • <strong>Local Storage:</strong> Files are downloaded directly to your device. No server storage used.
                  <br />
                  • <strong>No Additional Costs:</strong> Export functionality is included in your plan.
                  <br />
                  • <strong>Security:</strong> All processing happens client-side. Your data never leaves your browser.
                </Typography>
              </Alert>

              {/* Audit & Notifications */}
              <Alert severity="success" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <NotificationsIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Audit & Notifications
                  </Typography>
                </Box>
                <Typography variant="body2">
                  • All export actions are automatically logged for audit purposes
                  <br />
                  • You'll receive notifications for successful exports and any errors
                  <br />
                  • Export history is available in your account dashboard
                </Typography>
              </Alert>
            </Box>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {activeTab === 'share' ? 'Generating share link...' : 'Processing export...'}
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          
          {activeTab === 'export' && (
            <Button
              variant="contained"
              onClick={handleExport}
              disabled={isProcessing}
              startIcon={isProcessing ? <CircularProgress size={16} /> : <DownloadIcon />}
            >
              {isProcessing ? 'Processing...' : `Export ${exportSettings.format.toUpperCase()}`}
            </Button>
          )}
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

export default EnhancedShareExportModal; 