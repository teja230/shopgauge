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
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import SvgIcon from '@mui/material/SvgIcon';
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
  const [shareSettings, setShareSettings] = useState({
    includeAnalytics: true,
    includeForecasts: true,
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

  // Enhanced PNG export with proper SVG handling
  const handleExportPNG = useCallback(async () => {
    debugLog.info('handleExportPNG called', { 
      chartRef: chartRef.current,
      chartRefExists: !!chartRef.current,
      chartRefType: chartRef.current?.constructor?.name,
      chartRefChildren: chartRef.current?.children?.length,
      chartRefInnerHTML: chartRef.current?.innerHTML?.substring(0, 200)
    }, 'EnhancedShareExportModal');
    
    if (!chartRef.current) {
      showError('Chart is not available for export. Please make sure the chart is visible and try again.');
      debugLog.error('Export PNG failed: chartRef.current is null', {
        chartRefDefined: !!chartRef,
        modalOpen: open,
        chartTitle,
        chartType
      }, 'EnhancedShareExportModal');
      return;
    }

    // Additional validation: check if chart contains any content
    if (!chartRef.current.children || chartRef.current.children.length === 0) {
      showError('Chart content is not ready for export. Please wait for the chart to fully load and try again.');
      debugLog.error('Export PNG failed: chartRef has no children', {
        chartRefHTML: chartRef.current.outerHTML.substring(0, 300),
        childrenLength: chartRef.current.children.length
      }, 'EnhancedShareExportModal');
      return;
    }

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

      // Use html2canvas directly for reliable capture across browsers & SVG content
      const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: theme.palette.background.paper,
        scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        imageTimeout: 15000,
        removeContainer: false,
        ignoreElements: (element) => {
          return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
        },
        onclone: (clonedDoc) => {
          const clonedSvgs = clonedDoc.querySelectorAll('svg');
          clonedSvgs.forEach(svg => {
            svg.style.backgroundColor = 'transparent';
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          });
        },
      });
      setProgress(50);

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
  }, [chartRef, exportSettings, generateFilename, theme, showInfo, showSuccess, showError, chartTitle, chartType]);

  // Enhanced PDF export
  const handleExportPDF = useCallback(async () => {
    debugLog.info('handleExportPDF called', { 
      chartRef: chartRef.current,
      chartRefExists: !!chartRef.current,
      chartRefType: chartRef.current?.constructor?.name,
      chartRefChildren: chartRef.current?.children?.length,
      chartRefInnerHTML: chartRef.current?.innerHTML?.substring(0, 200)
    }, 'EnhancedShareExportModal');
    
    if (!chartRef.current) {
      showError('Chart is not available for export. Please make sure the chart is visible and try again.');
      debugLog.error('Export PDF failed: chartRef.current is null', {
        chartRefDefined: !!chartRef,
        modalOpen: open,
        chartTitle,
        chartType
      }, 'EnhancedShareExportModal');
      return;
    }

    // Additional validation: check if chart contains any content
    if (!chartRef.current.children || chartRef.current.children.length === 0) {
      showError('Chart content is not ready for export. Please wait for the chart to fully load and try again.');
      debugLog.error('Export PDF failed: chartRef has no children', {
        chartRefHTML: chartRef.current.outerHTML.substring(0, 300),
        childrenLength: chartRef.current.children.length
      }, 'EnhancedShareExportModal');
      return;
    }

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
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale: 2, // Always use high quality for PDF
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
        });
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
  }, [chartRef, exportSettings, generateFilename, shopName, chartTitle, chartType, metrics, theme, showInfo, showSuccess, showError]);

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
    
    // Single ShopGauge link (no red background)
    const shopGaugeUrl = 'https://www.shopgaugeai.com';
    const enhancedMessage = `${message}\n\n🌐 Powered by ShopGauge: ${shopGaugeUrl}`;
    
    try {
      switch (platform) {
        case 'linkedin': {
          // Use LinkedIn's newer sharing approach with text in URL
          const linkedinText = encodeURIComponent(enhancedMessage);
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shopGaugeUrl)}&title=${encodeURIComponent(chartTitle)}&text=${linkedinText}`);
          showInfo('Sharing your business insights on LinkedIn...');
          break;
        }
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(enhancedMessage)}&url=${encodeURIComponent(shopGaugeUrl)}`);
          showInfo('Sharing your performance insights on Twitter...');
          break;
        case 'email':
          window.open(`mailto:?subject=${encodeURIComponent(`${shopName || 'Store'} ${chartTitle} Insights`)}&body=${encodeURIComponent(enhancedMessage)}`);
          showInfo('Opening email to share your business insights...');
          break;
        case 'slack': {
          // Copy message and open Slack web app
          await navigator.clipboard.writeText(enhancedMessage);
          window.open('https://app.slack.com/client');
          showSuccess('Message copied! Opening Slack...');
          break;
        }
        case 'teams': {
          // Copy message and open Teams web app
          await navigator.clipboard.writeText(enhancedMessage);
          window.open('https://teams.microsoft.com');
          showSuccess('Message copied! Opening Teams...');
          break;
        }
        case 'copy':
          await navigator.clipboard.writeText(enhancedMessage);
          setCopiedToClipboard(true);
          setTimeout(() => setCopiedToClipboard(false), 3000);
          showSuccess('Performance insights copied to clipboard!');
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

                  </Box>
                </CardContent>
              </Card>

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
                    startIcon={<SlackLogoIcon fontSize="small" />}
                    onClick={() => handleSocialShare('slack')}
                  >
                    Slack
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<TeamsLogoIcon fontSize="small" />}
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

              {/* Privacy & Security Information */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StorageIcon sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Privacy & Security
                  </Typography>
                </Box>
                <Typography variant="body2">
                  • <strong>Local Processing:</strong> All exports are generated in your browser—no data is sent to our servers.<br />
                  • <strong>Private by Default:</strong> Your chart data and exports remain private and are never stored or shared unless you choose to share.<br />
                  • <strong>No Tracking:</strong> We do not track or store your exported files.
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
                  • All export actions are automatically logged for audit purposes<br />
                  • You'll receive notifications for successful exports and any errors
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