import React, { useState, useCallback, useRef } from 'react';
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
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Download as DownloadIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
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

interface ExportModalProps {
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

const ExportModal: React.FC<ExportModalProps> = ({
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
  const { showInfo, showSuccess, showError } = useNotifications();
  const { shop } = useAuth();
  
  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 'high',
    includeWatermark: true,
    includeData: true,
    includeMetadata: true,
  });

  // Generate export filename
  const generateFilename = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedTitle = chartTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedShop = shopName?.replace(/[^a-zA-Z0-9]/g, '_') || 'chart';
    return `${sanitizedShop}_${sanitizedTitle}_${timestamp}`;
  }, [chartTitle, shopName]);

  // Enhanced chart readiness detection
  const waitForChartReadiness = useCallback(async (maxWaitTime = 5000): Promise<boolean> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (!chartRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check for SVG elements (works for both Classic and Advanced views)
      const svgElements = chartRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check if SVG has actual content (paths, circles, etc.)
      let hasContent = false;
      svgElements.forEach(svg => {
        const paths = svg.querySelectorAll('path, circle, rect, line');
        if (paths.length > 0) {
          hasContent = true;
        }
      });
      
      if (!hasContent) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Chart appears ready
      debugLog.info('Chart readiness confirmed', {
        svgCount: svgElements.length,
        hasContent,
        waitTime: Date.now() - startTime
      }, 'ExportModal');
      
      return true;
    }
    
    debugLog.warn('Chart readiness timeout', {
      waitTime: Date.now() - startTime,
      maxWaitTime
    }, 'ExportModal');
    
    return false;
  }, [chartRef]);

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
    }, 'ExportModal');
    
    if (!chartRef.current) {
      showError('Chart is not available for export. Please make sure the chart is visible and try again.');
      debugLog.error('Export PNG failed: chartRef.current is null', {
        chartRefDefined: !!chartRef,
        modalOpen: open,
        chartTitle,
        chartType
      }, 'ExportModal');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting enhanced PNG export with chart readiness check', { 
      quality: exportSettings.quality, 
      filename: generateFilename(),
      chartType 
    }, 'ExportModal');
    
    showInfo('Preparing chart for export...');

    try {
      setProgress(10);

      // Wait for chart to be fully ready
      const isReady = await waitForChartReadiness(5000);
      if (!isReady) {
        showError('Chart is not ready for export. Please wait for the chart to fully load and try again.');
        debugLog.error('Export PNG failed: Chart readiness timeout', {
          chartRefHTML: chartRef.current?.outerHTML?.substring(0, 500),
          chartTitle,
          chartType
        }, 'ExportModal');
        return;
      }

      setProgress(25);
      showInfo('Generating high-quality chart image...');

      // Enhanced SVG detection for nested chart structures (Advanced View)
      const svgElements = chartRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        showError('Chart visualization is not ready for export. Please wait for the chart to fully render and try again.');
        debugLog.error('Export PNG failed: No SVG elements found after readiness check', {
          chartRefHTML: chartRef.current.outerHTML.substring(0, 500),
          chartTitle,
          chartType
        }, 'ExportModal');
        return;
      }

      debugLog.info('SVG elements found for export', {
        svgCount: svgElements.length,
        firstSvgWidth: svgElements[0]?.getAttribute('width'),
        firstSvgHeight: svgElements[0]?.getAttribute('height'),
        firstSvgViewBox: svgElements[0]?.getAttribute('viewBox'),
        chartTitle,
        chartType
      }, 'ExportModal');

      const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;

      let canvas: HTMLCanvasElement;
      try {
        // Use the first (and usually only) SVG element
        const targetSvg = svgElements[0];
        
        // Wait briefly to ensure any animations have finished rendering
        await new Promise(res => setTimeout(res, 300));
        setProgress(50);
        
        // Attempt precise SVG capture first
        canvas = await convertContainerSvgToCanvas(chartRef.current, scale);
        debugLog.info('SVG -> Canvas conversion succeeded', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          scale
        }, 'ExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed, falling back to html2canvas', svgErr, 'ExportModal');

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
          height: chartRef.current.offsetHeight,
          width: chartRef.current.offsetWidth,
        });
        
        debugLog.info('html2canvas fallback succeeded', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        }, 'ExportModal');
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
        filename: link.download,
        canvasSize: `${canvas.width}x${canvas.height}`
      });

    } catch (error) {
      debugLog.error('PNG export failed:', error, 'ExportModal');
      showError('Export failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, theme, showInfo, showSuccess, showError, chartTitle, chartType, waitForChartReadiness]);

  // Enhanced PDF export
  const handleExportPDF = useCallback(async () => {
    debugLog.info('handleExportPDF called', { 
      chartRef: chartRef.current,
      chartRefExists: !!chartRef.current,
      chartRefType: chartRef.current?.constructor?.name,
      chartRefChildren: chartRef.current?.children?.length,
      chartRefInnerHTML: chartRef.current?.innerHTML?.substring(0, 200)
    }, 'ExportModal');
    
    if (!chartRef.current) {
      showError('Chart is not available for export. Please make sure the chart is visible and try again.');
      debugLog.error('Export PDF failed: chartRef.current is null', {
        chartRefDefined: !!chartRef,
        modalOpen: open,
        chartTitle,
        chartType
      }, 'ExportModal');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    debugLog.info('Starting enhanced PDF export with chart readiness check', { 
      filename: generateFilename(), 
      includeWatermark: exportSettings.includeWatermark,
      includeMetadata: exportSettings.includeMetadata 
    }, 'ExportModal');
    
    showInfo('Preparing chart for PDF export...');

    try {
      setProgress(10);

      // Wait for chart to be fully ready
      const isReady = await waitForChartReadiness(5000);
      if (!isReady) {
        showError('Chart is not ready for export. Please wait for the chart to fully load and try again.');
        debugLog.error('Export PDF failed: Chart readiness timeout', {
          chartRefHTML: chartRef.current?.outerHTML?.substring(0, 500),
          chartTitle,
          chartType
        }, 'ExportModal');
        return;
      }

      setProgress(25);
      showInfo('Generating professional PDF report...');

      // Enhanced SVG detection for nested chart structures (Advanced View)
      const svgElements = chartRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        showError('Chart visualization is not ready for export. Please wait for the chart to fully render and try again.');
        debugLog.error('Export PDF failed: No SVG elements found after readiness check', {
          chartRefHTML: chartRef.current.outerHTML.substring(0, 500),
          chartTitle,
          chartType
        }, 'ExportModal');
        return;
      }

      debugLog.info('SVG elements found for PDF export', {
        svgCount: svgElements.length,
        firstSvgWidth: svgElements[0]?.getAttribute('width'),
        firstSvgHeight: svgElements[0]?.getAttribute('height'),
        firstSvgViewBox: svgElements[0]?.getAttribute('viewBox'),
        chartTitle,
        chartType
      }, 'ExportModal');

      const scale = exportSettings.quality === 'ultra' ? 3 : exportSettings.quality === 'high' ? 2 : 1;

      let canvas: HTMLCanvasElement;
      try {
        // Wait briefly to ensure animations finished
        await new Promise(res => setTimeout(res, 300));
        setProgress(50);
        
        canvas = await convertContainerSvgToCanvas(chartRef.current, 2);
        debugLog.info('SVG -> Canvas conversion succeeded for PDF', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        }, 'ExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed for PDF, falling back to html2canvas', svgErr, 'ExportModal');
        canvas = await html2canvas(chartRef.current, {
          backgroundColor: theme.palette.background.paper,
          scale: 2, // High resolution for PDF
          logging: false,
          useCORS: true,
          allowTaint: true,
          foreignObjectRendering: true,
          height: chartRef.current.offsetHeight,
          width: chartRef.current.offsetWidth,
        });
        
        debugLog.info('html2canvas fallback succeeded for PDF', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height
        }, 'ExportModal');
      }

      setProgress(60);

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
      
      // Add metadata
      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 30);
      if (metrics?.timeRange) {
        pdf.text(`Period: ${metrics.timeRange}`, 10, 35);
      }
      if (metrics?.confidenceScore) {
        pdf.text(`Confidence: ${Math.round(metrics.confidenceScore * 100)}%`, 10, 40);
      }
      
      // Add chart
      const yPosition = Math.min(50, pdfHeight - imgHeight - 20);
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, Math.min(imgHeight, pdfHeight - yPosition - 15));
      
      // Add footer with branding if enabled
      if (exportSettings.includeWatermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(160, 160, 160);
        pdf.text('🌐 Powered by ShopGauge: https://www.shopgaugeai.com', 10, pdfHeight - 10);
      }
      
      setProgress(90);
      
      pdf.save(`${generateFilename()}.pdf`);
      setProgress(100);
      showSuccess('Professional PDF report generated successfully!');
      
      // Log audit event
      await logAuditEvent('export', 'pdf', { 
        chartTitle, 
        chartType, 
        includeWatermark: exportSettings.includeWatermark,
        filename: `${generateFilename()}.pdf`,
        canvasSize: `${canvas.width}x${canvas.height}`,
        pdfSize: `${pdfWidth}x${pdfHeight}mm`
      });

    } catch (error) {
      debugLog.error('PDF export failed:', error, 'ExportModal');
      showError('PDF generation failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, shopName, chartTitle, metrics, theme, showInfo, showSuccess, showError, chartType, waitForChartReadiness]);

  // Enhanced Excel export with multi-tab workbook
  const handleExportExcel = useCallback(async () => {
    // Handle different data formats
    let processedData: any[] = [];
    
    if (!data) {
      showError('No data available for Excel export');
      return;
    }
    
    // If data is an array (from RevenueChart), use it directly
    if (Array.isArray(data)) {
      processedData = data;
    } 
    // If data is an object with historical and predictions (from PredictionViewContainer)
    else if (data && typeof data === 'object' && ('historical' in data || 'predictions' in data)) {
      processedData = [
        ...(data.historical || []),
        ...(data.predictions || [])
      ];
    } else {
      showError('Invalid data format for Excel export');
      return;
    }
    
    if (processedData.length === 0) {
      showError('No data points available for Excel export');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
          debugLog.info('Starting enhanced Excel export', { 
        filename: generateFilename(),
        dataLength: processedData.length,
        includeData: exportSettings.includeData,
        includeMetadata: exportSettings.includeMetadata 
      }, 'ExportModal');
    
    showInfo('Generating comprehensive Excel workbook...');

    try {
      setProgress(25);

      const wb = XLSX.utils.book_new();
      let sheetsCreated = 0;

      // Main data sheet
      if (exportSettings.includeData) {
        const mainData = processedData.map((item: any, index: number) => ({
          Date: item.date || item.created_at || `Day ${index + 1}`,
          Revenue: item.revenue || item.total_price || 0,
          Orders: item.orders_count || 0,
          Conversion: item.conversion_rate || 0,
          Type: item.isPrediction ? 'Forecast' : 'Historical',
          Confidence: item.confidence_score || null,
        }));
        
        const ws = XLSX.utils.json_to_sheet(mainData);
        ws['!cols'] = [
          { width: 15 }, // Date
          { width: 12 }, // Revenue
          { width: 10 }, // Orders
          { width: 12 }, // Conversion
          { width: 12 }, // Type
          { width: 12 }, // Confidence
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Main Data');
        sheetsCreated++;
      }

      // Revenue forecast sheet
      if (processedData.some((item: any) => item.isPrediction)) {
        const revenueData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => ({
            Date: item.date || `Forecast Day ${index + 1}`,
            Revenue: item.revenue || item.total_price || 0,
            Confidence: item.confidence_score || 0.75,
            Period: metrics?.forecastPeriod || '30 days',
          }));
        
        const revenueWs = XLSX.utils.json_to_sheet(revenueData);
        revenueWs['!cols'] = [
          { width: 15 }, // Date
          { width: 12 }, // Revenue
          { width: 12 }, // Confidence
          { width: 15 }, // Period
        ];
        XLSX.utils.book_append_sheet(wb, revenueWs, 'Revenue Forecast');
        sheetsCreated++;
      }

      // Orders forecast sheet
      if (processedData.some((item: any) => item.isPrediction && item.orders_count)) {
        const ordersData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => ({
            Date: item.date || `Forecast Day ${index + 1}`,
            Orders: item.orders_count || 0,
            Confidence: item.confidence_score || 0.75,
            Period: metrics?.forecastPeriod || '30 days',
          }));
        
        const ordersWs = XLSX.utils.json_to_sheet(ordersData);
        ordersWs['!cols'] = [
          { width: 15 }, // Date
          { width: 12 }, // Orders
          { width: 12 }, // Confidence
          { width: 15 }, // Period
        ];
        XLSX.utils.book_append_sheet(wb, ordersWs, 'Orders Forecast');
        sheetsCreated++;
      }

      // Conversion forecast sheet
      if (processedData.some((item: any) => item.isPrediction && item.conversion_rate)) {
        const conversionData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => ({
            Date: item.date || `Forecast Day ${index + 1}`,
            Conversion: item.conversion_rate || 0,
            Confidence: item.confidence_score || 0.75,
            Period: metrics?.forecastPeriod || '30 days',
          }));
        
        const conversionWs = XLSX.utils.json_to_sheet(conversionData);
        conversionWs['!cols'] = [
          { width: 15 }, // Date
          { width: 12 }, // Conversion
          { width: 12 }, // Confidence
          { width: 15 }, // Period
        ];
        XLSX.utils.book_append_sheet(wb, conversionWs, 'Conversion Forecast');
        sheetsCreated++;
      }

      // Summary sheet
      const summaryData = [
        { Metric: 'Total Revenue', Value: metrics?.revenue || 0 },
        { Metric: 'Total Orders', Value: metrics?.orders || 0 },
        { Metric: 'Average Conversion', Value: metrics?.conversion ? `${(metrics.conversion * 100).toFixed(2)}%` : 'N/A' },
        { Metric: 'Time Period', Value: metrics?.timeRange || 'N/A' },
        { Metric: 'Forecast Period', Value: metrics?.forecastPeriod || 'N/A' },
        { Metric: 'Forecast Revenue', Value: metrics?.forecastRevenue || 0 },
        { Metric: 'Forecast Orders', Value: metrics?.forecastOrders || 0 },
        { Metric: 'Confidence Score', Value: metrics?.confidenceScore ? `${Math.round(metrics.confidenceScore * 100)}%` : 'N/A' },
      ];
      
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      summaryWs['!cols'] = [{ width: 20 }, { width: 30 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
      sheetsCreated++;

      // Add metadata sheet if enabled
      if (exportSettings.includeMetadata) {
        const metadataSheet = [
          { Property: 'Chart Title', Value: chartTitle },
          { Property: 'Chart Type', Value: chartType },
          { Property: 'Shop Name', Value: shopName || 'N/A' },
          { Property: 'Export Date', Value: new Date().toISOString() },
          { Property: 'Export Time', Value: new Date().toLocaleString() },
          { Property: 'Sheets Created', Value: sheetsCreated },
          { Property: 'Total Data Points', Value: processedData.length },
          { Property: 'Includes Forecasts', Value: processedData.some((item: any) => item.isPrediction) ? 'Yes' : 'No' },
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
      debugLog.error('Excel export failed:', error, 'ExportModal');
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

  // Audit logging function
  const logAuditEvent = useCallback(async (action: string, type: string, details: any) => {
    try {
      // Log locally for debugging
      debugLog.info(`Audit: ${action}_${type}`, { 
        shop: shop || shopName,
        timestamp: new Date().toISOString(),
        ...details 
      }, 'ExportModal');
      
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
      debugLog.info('Audit logged successfully', result, 'ExportModal');
      
    } catch (error) {
      debugLog.error('Failed to log audit event:', error, 'ExportModal');
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
          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
          color: 'white',
          borderRadius: '8px 8px 0 0'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DownloadIcon sx={{ mr: 1.5, fontSize: 28 }} />
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Export
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

                {exportSettings.format === 'excel' && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportSettings.includeMetadata}
                        onChange={(e) => setExportSettings(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                      />
                    }
                    label="Include metadata sheet"
                  />
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Export Progress */}
          {isProcessing && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Exporting chart...
                </Typography>
                <LinearProgress variant="determinate" value={progress} />
              </CardContent>
            </Card>
          )}
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
          
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />}
            size="large"
            sx={{ 
              minWidth: 180,
              background: 'linear-gradient(45deg, #059669 30%, #10b981 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #047857 30%, #059669 90%)',
              }
            }}
          >
            {isProcessing ? 'Processing...' : `Export ${exportSettings.format.toUpperCase()}`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ExportModal; 