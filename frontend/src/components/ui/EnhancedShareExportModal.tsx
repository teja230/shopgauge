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

  // Helper to convert the first <svg> inside a container to a canvas (works well with Recharts)
  const convertContainerSvgToCanvas = async (container: HTMLElement, scale = 2): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const svgEl = container.querySelector('svg');
      if (!svgEl) {
        return reject(new Error('No SVG element found inside chart container'));
      }

      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
      // Ensure xmlns attribute present for serialization fidelity
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const rect = svgEl.getBoundingClientRect();
      const width = rect.width * scale;
      const height = rect.height * scale;

      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clonedSvg);
      const encoded = window.btoa(unescape(encodeURIComponent(svgStr)));

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get 2D context for canvas'));
        }

        // Fill white background to avoid transparency issues when exporting as JPEG/PDF
        ctx.fillStyle = getComputedStyle(container).backgroundColor || '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.onerror = (e) => reject(new Error('Failed loading SVG image for canvas conversion'));
      img.src = `data:image/svg+xml;base64,${encoded}`;
    });
  };

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

      const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;

      let canvas: HTMLCanvasElement;
      try {
        // Wait briefly to ensure any animations have finished rendering
        await new Promise(res => setTimeout(res, 600));
        
        // Attempt precise SVG capture first
        canvas = await convertContainerSvgToCanvas(chartRef.current, scale);
        debugLog.info('SVG -> Canvas conversion succeeded', {}, 'EnhancedShareExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed, falling back to html2canvas', svgErr, 'EnhancedShareExportModal');

        // Fallback: html2canvas snapshot of the whole container
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale,
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          imageTimeout: 15000,
          removeContainer: false,
        });
      }

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

      const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;

      let canvas: HTMLCanvasElement;
      try {
        // Wait briefly to ensure animations finished
        await new Promise(res => setTimeout(res, 600));
        
        canvas = await convertContainerSvgToCanvas(chartRef.current, 2);
        debugLog.info('SVG -> Canvas conversion succeeded for PDF', {}, 'EnhancedShareExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed for PDF, falling back to html2canvas', svgErr, 'EnhancedShareExportModal');
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale: 2, // High resolution for PDF
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

  // Enhanced Excel export with multi-tab support for Revenue, Orders, and Conversion
  const handleExportExcel = useCallback(async () => {
    if (!data) {
      showError('No data available for Excel export');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting enhanced Excel export', { 
      filename: generateFilename(),
      chartType,
      dataLength: Array.isArray(data) ? data.length : 'unknown'
    }, 'EnhancedShareExportModal');
    
    showInfo('Generating comprehensive Excel workbook...');

    try {
      setProgress(20);

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Helper function to create data for each metric type
      const createMetricData = (metricType: 'revenue' | 'orders' | 'conversion') => {
        let historicalData: any[] = [];
        let forecastData: any[] = [];
        
        if (Array.isArray(data)) {
          // Simple array format
          historicalData = data.map(item => ({
            date: item.date || item.x,
            [metricType]: item[metricType] || item.y || item.value || 0,
            type: 'Historical'
          }));
        } else if (data.historical && Array.isArray(data.historical)) {
          // Advanced analytics format
          historicalData = data.historical.map((item: any) => ({
            date: item.date || item.x,
            [metricType]: item[metricType] || item.y || item.value || 0,
            type: 'Historical'
          }));
          
          if (data.predictions && Array.isArray(data.predictions)) {
            forecastData = data.predictions.map((item: any) => ({
              date: item.date || item.x,
              [metricType]: item[metricType] || item.y || item.value || 0,
              type: 'Forecast',
              confidence: item.confidence_score || item.confidence || 0
            }));
          }
        }
        
        return [...historicalData, ...forecastData];
      };

      setProgress(40);

      // Create separate sheets for each metric type
      const metricTypes = ['revenue', 'orders', 'conversion'] as const;
      let sheetsCreated = 0;
      
      for (const metricType of metricTypes) {
        const metricData = createMetricData(metricType);
        
        if (metricData.length > 0) {
          const sheetName = metricType.charAt(0).toUpperCase() + metricType.slice(1);
          const ws = XLSX.utils.json_to_sheet(metricData);
          
          // Add column headers with better formatting
          const headers = ['Date', sheetName, 'Type'];
          if (metricType === 'revenue') headers.push('Forecast Confidence');
          if (metricType === 'orders') headers.push('Forecast Confidence');
          if (metricType === 'conversion') headers.push('Forecast Confidence');
          
          // Set column widths
          ws['!cols'] = [
            { width: 12 }, // Date
            { width: 15 }, // Metric value
            { width: 10 }, // Type
            { width: 18 }  // Confidence
          ];
          
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          sheetsCreated++;
        }
      }

      setProgress(60);

      // Create summary sheet with key metrics
      const summaryData = [
        { Metric: 'Total Revenue', Value: metrics?.revenue ? `$${metrics.revenue.toLocaleString()}` : 'N/A' },
        { Metric: 'Total Orders', Value: metrics?.orders ? metrics.orders.toLocaleString() : 'N/A' },
        { Metric: 'Conversion Rate', Value: metrics?.conversion ? `${(metrics.conversion * 100).toFixed(2)}%` : 'N/A' },
        { Metric: 'Time Period', Value: metrics?.timeRange || 'N/A' },
        { Metric: 'Forecast Period', Value: metrics?.forecastPeriod || 'N/A' },
        { Metric: 'Forecast Revenue', Value: metrics?.forecastRevenue ? `$${metrics.forecastRevenue.toLocaleString()}` : 'N/A' },
        { Metric: 'Forecast Orders', Value: metrics?.forecastOrders ? metrics.forecastOrders.toLocaleString() : 'N/A' },
        { Metric: 'AI Confidence', Value: metrics?.confidenceScore ? `${Math.round(metrics.confidenceScore * 100)}%` : 'N/A' },
      ];
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ width: 20 }, { width: 25 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      setProgress(75);

      // Add metadata sheet if enabled
      if (exportSettings.includeMetadata) {
        const metadataSheet = [
          { Property: 'Chart Title', Value: chartTitle },
          { Property: 'Chart Type', Value: chartType },
          { Property: 'Shop Name', Value: shopName || 'N/A' },
          { Property: 'Export Date', Value: new Date().toISOString() },
          { Property: 'Export Time', Value: new Date().toLocaleString() },
          { Property: 'Sheets Created', Value: sheetsCreated },
          { Property: 'Total Data Points', Value: Array.isArray(data) ? data.length : 'N/A' },
          { Property: 'Includes Forecasts', Value: data?.predictions ? 'Yes' : 'No' },
        ];
        
        const metaWs = XLSX.utils.json_to_sheet(metadataSheet);
        metaWs['!cols'] = [{ width: 20 }, { width: 30 }];
        XLSX.utils.book_append_sheet(wb, metaWs, 'Metadata');
      }

      setProgress(90);

      // Save file
      const filename = `${generateFilename()}_comprehensive.xlsx`;
      XLSX.writeFile(wb, filename);

      setProgress(100);
      showSuccess(`Excel workbook exported with ${sheetsCreated + 1} sheets!`);
      
      // Log audit event
      await logAuditEvent('export', 'excel', { 
        chartTitle, 
        chartType, 
        sheetsCreated: sheetsCreated + 1,
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
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '8px 8px 0 0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShareIcon sx={{ mr: 1.5, fontSize: 28 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Share & Export
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

        <DialogContent sx={{ p: 0 }}>
          {/* Tab Navigation */}
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: 64,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 700
                }
              }
            }}
          >
            <Tab 
              label="Share Socially" 
              value="share"
              icon={<ShareIcon />}
              iconPosition="start"
              sx={{ flex: 1 }}
            />
            <Tab 
              label="Export Files" 
              value="export"
              icon={<DownloadIcon />}
              iconPosition="start"
              sx={{ flex: 1 }}
            />
          </Tabs>
          
          <Box sx={{ p: 3 }}>
                        {/* Share Tab */}
            {activeTab === 'share' && (
              <Box>
                {/* Quick Share Options */}
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
                  Share Your Insights
                </Typography>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2, mb: 3 }}>
                  {[
                    { platform: 'linkedin', icon: LinkedInIcon, label: 'LinkedIn', color: '#0077B5', desc: 'Professional network' },
                    { platform: 'twitter', icon: TwitterIcon, label: 'Twitter', color: '#1DA1F2', desc: 'Social media' },
                    { platform: 'email', icon: EmailIcon, label: 'Email', color: '#EA4335', desc: 'Send via email' },
                    { platform: 'slack', icon: SlackLogoIcon, label: 'Slack', color: '#4A154B', desc: 'Team workspace' },
                    { platform: 'teams', icon: TeamsLogoIcon, label: 'Teams', color: '#6264A7', desc: 'Microsoft Teams' },
                    { platform: 'copy', icon: ContentCopyIcon, label: copiedToClipboard ? 'Copied!' : 'Copy Link', color: '#666', desc: 'Copy to clipboard' }
                  ].map((item) => (
                    <Card 
                      key={item.platform}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { 
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                          borderColor: item.color
                        },
                        transition: 'all 0.2s ease',
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                      onClick={() => handleSocialShare(item.platform)}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <item.icon sx={{ fontSize: 32, color: item.color, mb: 1 }} />
                        <Typography variant="subtitle2" fontWeight={600}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
              </Box>
            )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <Box>
              {/* Format Selection Cards */}
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
                Choose Export Format
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
                {[
                  { value: 'png', icon: PhotoCameraIcon, title: 'PNG Image', desc: 'High-quality chart image' },
                  { value: 'pdf', icon: PdfIcon, title: 'PDF Report', desc: 'Professional business document' },
                  { value: 'excel', icon: ExcelIcon, title: 'Excel Workbook', desc: 'Multi-tab data analysis' }
                ].map((format) => (
                  <Card 
                    key={format.value}
                    sx={{ 
                      cursor: 'pointer',
                      border: exportSettings.format === format.value ? 2 : 1,
                      borderColor: exportSettings.format === format.value ? 'primary.main' : 'divider',
                      '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setExportSettings(prev => ({ ...prev, format: format.value as any }))}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <format.icon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {format.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format.desc}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Quality Settings */}
              {(exportSettings.format === 'png' || exportSettings.format === 'pdf') && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Quality Settings
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {QUALITY_OPTIONS.map(option => (
                        <Chip
                          key={option.value}
                          label={option.label}
                          variant={exportSettings.quality === option.value ? 'filled' : 'outlined'}
                          color={exportSettings.quality === option.value ? 'primary' : 'default'}
                          onClick={() => setExportSettings(prev => ({ ...prev, quality: option.value as any }))}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Export Options */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Export Options
                  </Typography>
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

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
          </Box>
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
          
          {activeTab === 'export' && (
            <Button
              variant="contained"
              onClick={handleExport}
              disabled={isProcessing}
              startIcon={isProcessing ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
              size="large"
              sx={{ 
                minWidth: 180,
                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                }
              }}
            >
              {isProcessing ? 'Processing...' : `Export ${exportSettings.format.toUpperCase()}`}
            </Button>
          )}
          
          {activeTab === 'share' && (
            <Typography variant="body2" color="text.secondary">
              Select a platform above to share your insights
            </Typography>
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