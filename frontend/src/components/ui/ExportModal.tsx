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

  // Enhanced chart readiness detection with better timing and validation
  const waitForChartReadiness = useCallback(async (maxWaitTime = 8000): Promise<boolean> => {
    const startTime = Date.now();
    let lastCheckInfo = '';
    
    while (Date.now() - startTime < maxWaitTime) {
      if (!chartRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check for SVG elements (works for both Classic and Advanced views)
      const svgElements = chartRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        lastCheckInfo = 'No SVG elements found';
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Check if SVG has actual content (paths, circles, etc.)
      let hasContent = false;
      let contentInfo = '';
      svgElements.forEach((svg, index) => {
        const paths = svg.querySelectorAll('path, circle, rect, line, text');
        if (paths.length > 0) {
          hasContent = true;
          contentInfo += `SVG${index}: ${paths.length} elements; `;
        }
      });
      
      if (!hasContent) {
        lastCheckInfo = `Found ${svgElements.length} SVG(s) but no content: ${contentInfo}`;
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Additional validation: check if SVG has proper dimensions
      const firstSvg = svgElements[0];
      const svgRect = firstSvg.getBoundingClientRect();
      if (svgRect.width === 0 || svgRect.height === 0) {
        lastCheckInfo = `SVG has zero dimensions: ${svgRect.width}x${svgRect.height}`;
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      // Chart appears ready
      debugLog.info('Chart readiness confirmed', {
        svgCount: svgElements.length,
        hasContent,
        contentInfo,
        svgDimensions: `${svgRect.width}x${svgRect.height}`,
        waitTime: Date.now() - startTime
      }, 'ExportModal');
      
      return true;
    }
    
    debugLog.error('Chart readiness timeout', {
      waitTime: Date.now() - startTime,
      maxWaitTime,
      lastCheckInfo,
      chartRefHTML: chartRef.current?.outerHTML?.substring(0, 500) || 'No chart ref'
    }, 'ExportModal');
    
    return false;
  }, [chartRef]);

  // Enhanced SVG to canvas conversion with proper styling and error handling
  const convertContainerSvgToCanvas = async (container: HTMLElement, scale = 2): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const svgEl = container.querySelector('svg');
      if (!svgEl) {
        return reject(new Error('No SVG element found inside chart container'));
      }

      debugLog.info('Starting SVG to canvas conversion', {
        svgWidth: svgEl.getAttribute('width'),
        svgHeight: svgEl.getAttribute('height'),
        scale,
        containerBounds: container.getBoundingClientRect()
      }, 'ExportModal');

      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
      
      // Ensure proper SVG attributes for clean rendering
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      
      // Get dimensions from the original SVG
      const rect = svgEl.getBoundingClientRect();
      const svgWidth = rect.width || parseInt(svgEl.getAttribute('width') || '800');
      const svgHeight = rect.height || parseInt(svgEl.getAttribute('height') || '600');
      
      // Set explicit dimensions on cloned SVG for consistent rendering
      clonedSvg.setAttribute('width', svgWidth.toString());
      clonedSvg.setAttribute('height', svgHeight.toString());
      clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

      // Preserve and enhance styles for better rendering
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        * { 
          font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif !important;
        }
        text, .recharts-text {
          text-rendering: optimizeLegibility !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
        }
        .recharts-text {
          font-size: 12px !important;
          fill: #666 !important;
        }
        .recharts-cartesian-axis-tick-value {
          font-size: 11px !important;
          fill: #666 !important;
        }
        .recharts-legend-item-text {
          font-size: 12px !important;
          fill: #333 !important;
        }
        .recharts-tooltip-wrapper {
          font-size: 12px !important;
        }
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke: #f0f0f0 !important;
          stroke-width: 1 !important;
        }
        .recharts-cartesian-axis line {
          stroke: #ccc !important;
        }
      `;
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);

      // Calculate final canvas dimensions
      const canvasWidth = svgWidth * scale;
      const canvasHeight = svgHeight * scale;

      // IMPORTANT: Match raster size by overriding SVG dimensions for sharper output
      clonedSvg.setAttribute('width', canvasWidth.toString());
      clonedSvg.setAttribute('height', canvasHeight.toString());
      clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Enhanced SVG serialization with proper encoding
      const serializer = new XMLSerializer();
      let svgStr = serializer.serializeToString(clonedSvg);
      
      // Fix common SVG serialization issues
      svgStr = svgStr
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      debugLog.info('SVG serialization completed', {
        svgStringLength: svgStr.length,
        canvasWidth,
        canvasHeight
      }, 'ExportModal');

      // Use proper base64 encoding for better compatibility
      const encoded = btoa(unescape(encodeURIComponent(svgStr)));

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvasWidth;
          canvas.height = canvasHeight;
          
          const ctx = canvas.getContext('2d', { 
            alpha: false // Disable alpha for better PDF compatibility
          }) as CanvasRenderingContext2D;
          
          if (!ctx) {
            return reject(new Error('Could not get 2D context for canvas'));
          }

          // Set high-quality rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Fill with proper background color
          const bgColor = getComputedStyle(container).backgroundColor || 
                          theme.palette.background.paper || 
                          '#ffffff';
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          
          // Draw the SVG image with high quality
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          
          debugLog.info('Canvas rendering completed successfully', {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            backgroundColor: bgColor
          }, 'ExportModal');
          
          resolve(canvas);
        } catch (canvasError: any) {
          debugLog.error('Canvas rendering failed', canvasError, 'ExportModal');
          reject(new Error(`Canvas rendering failed: ${canvasError?.message || 'Unknown error'}`));
        }
      };
      
      img.onerror = (e) => {
        debugLog.error('SVG image loading failed', e, 'ExportModal');
        reject(new Error('Failed to load SVG image for canvas conversion. The SVG may contain invalid elements.'));
      };
      
      // Set the data URL with proper MIME type
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

      // Wait for chart to be fully ready (increased timeout)
      const isReady = await waitForChartReadiness(8000);
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
      const deviceScale = Math.min(3, Math.max(1, (window as any).devicePixelRatio || 1));
      const effectiveScale = Math.max(1, Math.min(6, scale * deviceScale));

      debugLog.info('Export scale configuration (PDF)', {
        baseScale: scale,
        deviceScale,
        effectiveScale
      }, 'ExportModal');
      const deviceScale = Math.min(3, Math.max(1, (window as any).devicePixelRatio || 1));
      const effectiveScale = Math.max(1, Math.min(6, scale * deviceScale));

      debugLog.info('Export scale configuration (PNG)', {
        baseScale: scale,
        deviceScale,
        effectiveScale
      }, 'ExportModal');

      let canvas: HTMLCanvasElement;
      let exportMethod = 'unknown';
      
      try {
        // Wait longer to ensure any animations have finished rendering
        await new Promise(res => setTimeout(res, 500));
        setProgress(50);
        
        // Attempt precise SVG capture first
        canvas = await convertContainerSvgToCanvas(chartRef.current, effectiveScale);
        exportMethod = 'svg-conversion';
        debugLog.info('SVG -> Canvas conversion succeeded', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          scale,
          method: exportMethod
        }, 'ExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed, falling back to html2canvas', svgErr, 'ExportModal');

        try {
          // Enhanced html2canvas fallback with optimized settings for chart rendering
          canvas = await html2canvas(chartRef.current, {
            backgroundColor: theme.palette.background.paper || '#ffffff',
            scale: effectiveScale,
            logging: false,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            imageTimeout: 30000, // Increased timeout for complex charts
            removeContainer: false,
            height: chartRef.current.offsetHeight,
            width: chartRef.current.offsetWidth,
            // Enhanced rendering options for better quality
            scrollX: 0,
            scrollY: 0,
            windowWidth: chartRef.current.offsetWidth,
            windowHeight: chartRef.current.offsetHeight,
            ignoreElements: (element) => {
              // Ignore problematic elements that might cause rendering issues
              const tagName = element.tagName.toLowerCase();
              return tagName === 'script' || 
                     tagName === 'noscript' || 
                     element.classList.contains('no-export') ||
                     ((element as HTMLElement).style?.display === 'none');
            },
            onclone: (clonedDoc, element) => {
              // Enhanced style preservation for cloned document
              try {
                // Apply theme background
                const clonedElement = clonedDoc.querySelector('[data-chart-container]') || element;
                if (clonedElement instanceof HTMLElement) {
                  clonedElement.style.background = theme.palette.background.paper || '#ffffff';
                  clonedElement.style.fontFamily = 'Roboto, Helvetica, Arial, sans-serif';
                }

                // Ensure all SVG elements have proper styling
                const svgElements = clonedDoc.querySelectorAll('svg');
                svgElements.forEach(svg => {
                  if (svg instanceof SVGElement) {
                    svg.style.fontFamily = 'Roboto, Helvetica, Arial, sans-serif';
                    // Ensure SVG has explicit dimensions
                    if (!svg.getAttribute('width') && svg.getBoundingClientRect().width > 0) {
                      svg.setAttribute('width', svg.getBoundingClientRect().width.toString());
                    }
                    if (!svg.getAttribute('height') && svg.getBoundingClientRect().height > 0) {
                      svg.setAttribute('height', svg.getBoundingClientRect().height.toString());
                    }
                  }
                });

                // Apply enhanced text styling for better readability
                const textElements = clonedDoc.querySelectorAll('text, .recharts-text, .recharts-cartesian-axis-tick-value');
                textElements.forEach(textEl => {
                  if (textEl instanceof HTMLElement || textEl instanceof SVGElement) {
                    textEl.style.fontFamily = 'Roboto, Helvetica, Arial, sans-serif';
                    textEl.style.fontSize = textEl.style.fontSize || '12px';
                  }
                });

                debugLog.info('html2canvas onclone completed', {
                  svgCount: svgElements.length,
                  textElementCount: textElements.length
                }, 'ExportModal');
              } catch (cloneError) {
                debugLog.warn('Error in html2canvas onclone', cloneError, 'ExportModal');
              }
            }
          });
          exportMethod = 'html2canvas';
          
          debugLog.info('html2canvas fallback succeeded', {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            method: exportMethod
          }, 'ExportModal');
        } catch (html2canvasErr) {
          debugLog.error('Both SVG and html2canvas methods failed', {
            svgError: svgErr,
            html2canvasError: html2canvasErr
          }, 'ExportModal');
          
          // Final fallback: Create a simple canvas with error message
          canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = theme.palette.background.paper;
            ctx.fillRect(0, 0, 800, 600);
            ctx.fillStyle = theme.palette.text.primary;
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Export failed - Chart not ready', 400, 300);
            ctx.font = '16px Arial';
            ctx.fillText('Please try again after the chart fully loads', 400, 330);
          }
          exportMethod = 'error-canvas';
          
          showError('Chart export partially failed. A placeholder image has been created. Please try again once the chart is fully loaded.');
        }
      }

      setProgress(75);

      // Create download link
      const link = document.createElement('a');
      link.download = `${generateFilename()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      setProgress(100);
      
      if (exportMethod === 'error-canvas') {
        showError('Chart export completed with errors. Please try again for better results.');
      } else {
        showSuccess('Chart exported successfully as PNG!');
      }
      
      // Log audit event
      await logAuditEvent('export', 'png', { 
        chartTitle, 
        chartType, 
        quality: exportSettings.quality,
        filename: link.download,
        canvasSize: `${canvas.width}x${canvas.height}`,
        method: exportMethod,
        success: exportMethod !== 'error-canvas'
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

      // Wait for chart to be fully ready (increased timeout)
      const isReady = await waitForChartReadiness(8000);
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
      let exportMethod = 'unknown';
      
      try {
        // Wait longer to ensure animations finished
        await new Promise(res => setTimeout(res, 500));
        setProgress(50);
        
        canvas = await convertContainerSvgToCanvas(chartRef.current, effectiveScale);
        exportMethod = 'svg-conversion';
        debugLog.info('SVG -> Canvas conversion succeeded for PDF', {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          method: exportMethod
        }, 'ExportModal');
      } catch (svgErr) {
        debugLog.warn('SVG conversion failed for PDF, falling back to html2canvas', svgErr, 'ExportModal');
        
        try {
          canvas = await html2canvas(chartRef.current, {
            backgroundColor: theme.palette.background.paper,
            scale: effectiveScale, // High resolution for PDF
            logging: false,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            height: chartRef.current.offsetHeight,
            width: chartRef.current.offsetWidth,
            ignoreElements: (element) => {
              return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
            },
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.querySelector('[data-chart-container]') || clonedDoc.body;
              if (clonedElement instanceof HTMLElement) {
                clonedElement.style.background = theme.palette.background.paper;
              }
            }
          });
          exportMethod = 'html2canvas';
          
          debugLog.info('html2canvas fallback succeeded for PDF', {
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            method: exportMethod
          }, 'ExportModal');
        } catch (html2canvasErr) {
          debugLog.error('Both SVG and html2canvas methods failed for PDF', {
            svgError: svgErr,
            html2canvasError: html2canvasErr
          }, 'ExportModal');
          
          // Final fallback: Create a simple canvas with error message for PDF
          canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = theme.palette.background.paper;
            ctx.fillRect(0, 0, 800, 600);
            ctx.fillStyle = theme.palette.text.primary;
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Export failed - Chart not ready', 400, 300);
            ctx.font = '16px Arial';
            ctx.fillText('Please try again after the chart fully loads', 400, 330);
          }
          exportMethod = 'error-canvas';
          
          showError('Chart export partially failed. A placeholder PDF has been created. Please try again once the chart is fully loaded.');
        }
      }

      setProgress(60);

      // Create PDF
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      // Generate high-quality image data from canvas (prefer JPEG with high quality to reduce aliasing)
      // Note: PNG is lossless but can appear softer when scaled down in PDFs; JPEG at high quality often looks sharper.
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      
      // Get PDF dimensions and calculate optimal image sizing
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const headerHeight = 50;
      const footerHeight = 20;
      
      // Calculate available space for the chart
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - headerHeight - footerHeight;
      
      // Calculate image dimensions maintaining aspect ratio
      const canvasAspectRatio = canvas.width / canvas.height;
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / canvasAspectRatio;
      
      // If image is too tall, scale by height instead
      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * canvasAspectRatio;
      }
      
      // Center the image horizontally
      const imgX = (pdfWidth - imgWidth) / 2;
      const imgY = headerHeight;
      
      debugLog.info('PDF layout calculated', {
        pdfSize: `${pdfWidth}x${pdfHeight}`,
        imageSize: `${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)}`,
        imagePosition: `${imgX.toFixed(1)},${imgY}`,
        canvasSize: `${canvas.width}x${canvas.height}`,
        aspectRatio: canvasAspectRatio.toFixed(2)
      }, 'ExportModal');
      
      // Add professional header with better typography
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(30, 30, 30);
      const title = `${shopName || 'Analytics'} - ${chartTitle}`;
      pdf.text(title, margin, 20);
      
      // Add subtitle/metadata with improved formatting
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      
      const metadata = [];
      metadata.push(`Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`);
      
      if (metrics?.timeRange) {
        metadata.push(`Period: ${metrics.timeRange}`);
      }
      if (metrics?.confidenceScore) {
        metadata.push(`Confidence: ${Math.round(metrics.confidenceScore * 100)}%`);
      }
      if (exportSettings.quality) {
        metadata.push(`Quality: ${exportSettings.quality.charAt(0).toUpperCase() + exportSettings.quality.slice(1)}`);
      }
      
      // Add metadata lines
      metadata.forEach((text, index) => {
        pdf.text(text, margin, 32 + (index * 6));
      });
      
      // Add the chart image with high quality
      try {
        // Use HIGH compression hint for better visual quality
        pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');
        debugLog.info('Chart image added to PDF successfully', {
          imageFormat: 'PNG',
          compression: 'FAST',
          finalSize: `${imgWidth.toFixed(1)}x${imgHeight.toFixed(1)}`
        }, 'ExportModal');
      } catch (imageError) {
        debugLog.error('Failed to add image to PDF', imageError, 'ExportModal');
        throw new Error('Failed to add chart image to PDF');
      }
      
      // Add footer with branding if enabled
      if (exportSettings.includeWatermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(160, 160, 160);
        pdf.text('🌐 Powered by ShopGauge: https://www.shopgaugeai.com', 10, pdfHeight - 10);
      }
      
      setProgress(90);
      
      pdf.save(`${generateFilename()}.pdf`);
      setProgress(100);
      
      if (exportMethod === 'error-canvas') {
        showError('PDF export completed with errors. Please try again for better results.');
      } else {
        showSuccess('Professional PDF report generated successfully!');
      }
      
      // Log audit event
      await logAuditEvent('export', 'pdf', { 
        chartTitle, 
        chartType, 
        includeWatermark: exportSettings.includeWatermark,
        filename: `${generateFilename()}.pdf`,
        canvasSize: `${canvas.width}x${canvas.height}`,
        pdfSize: `${pdfWidth}x${pdfHeight}mm`,
        method: exportMethod,
        success: exportMethod !== 'error-canvas'
      });

    } catch (error) {
      debugLog.error('PDF export failed:', error, 'ExportModal');
      showError('PDF generation failed. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, shopName, chartTitle, metrics, theme, showInfo, showSuccess, showError, chartType, waitForChartReadiness]);

  // Enhanced CSV export with multi-section workbook
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
    
          showInfo('Generating comprehensive CSV file...');

    try {
      setProgress(25);

      const sheets: any[] = [];
      let sheetsCreated = 0;

      // Main data sheet
      if (exportSettings.includeData) {
        const mainData = processedData.map((item: any, index: number) => [
          item.date || item.created_at || `Day ${index + 1}`,
          item.revenue || item.total_price || 0,
          item.orders_count || 0,
          item.conversion_rate || 0,
          item.isPrediction ? 'Forecast' : 'Historical',
          item.confidence_score || null,
        ]);
        
        // Add headers
        mainData.unshift(['Date', 'Revenue', 'Orders', 'Conversion', 'Type', 'Confidence']);
        
        sheets.push({
          name: 'Main Data',
          from: { array: mainData }
        });
        sheetsCreated++;
      }

      // Revenue forecast sheet
      if (processedData.some((item: any) => item.isPrediction)) {
        const revenueData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => [
            item.date || `Forecast Day ${index + 1}`,
            item.revenue || item.total_price || 0,
            item.confidence_score || 0.75,
            metrics?.forecastPeriod || '30 days',
          ]);
        
        // Add headers
        revenueData.unshift(['Date', 'Revenue', 'Confidence', 'Period']);
        
        sheets.push({
          name: 'Revenue Forecast',
          from: { array: revenueData }
        });
        sheetsCreated++;
      }

      // Orders forecast sheet
      if (processedData.some((item: any) => item.isPrediction && item.orders_count)) {
        const ordersData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => [
            item.date || `Forecast Day ${index + 1}`,
            item.orders_count || 0,
            item.confidence_score || 0.75,
            metrics?.forecastPeriod || '30 days',
          ]);
        
        // Add headers
        ordersData.unshift(['Date', 'Orders', 'Confidence', 'Period']);
        
        sheets.push({
          name: 'Orders Forecast',
          from: { array: ordersData }
        });
        sheetsCreated++;
      }

      // Conversion forecast sheet
      if (processedData.some((item: any) => item.isPrediction && item.conversion_rate)) {
        const conversionData = processedData
          .filter((item: any) => item.isPrediction)
          .map((item: any, index: number) => [
            item.date || `Forecast Day ${index + 1}`,
            item.conversion_rate || 0,
            item.confidence_score || 0.75,
            metrics?.forecastPeriod || '30 days',
          ]);
        
        // Add headers
        conversionData.unshift(['Date', 'Conversion', 'Confidence', 'Period']);
        
        sheets.push({
          name: 'Conversion Forecast',
          from: { array: conversionData }
        });
        sheetsCreated++;
      }

      // Summary sheet
      const summaryData = [
        ['Metric', 'Value'],
        ['Total Revenue', metrics?.revenue || 0],
        ['Total Orders', metrics?.orders || 0],
        ['Average Conversion', metrics?.conversion ? `${(metrics.conversion * 100).toFixed(2)}%` : 'N/A'],
        ['Time Period', metrics?.timeRange || 'N/A'],
        ['Forecast Period', metrics?.forecastPeriod || 'N/A'],
        ['Forecast Revenue', metrics?.forecastRevenue || 0],
        ['Forecast Orders', metrics?.forecastOrders || 0],
        ['Confidence Score', metrics?.confidenceScore ? `${Math.round(metrics.confidenceScore * 100)}%` : 'N/A'],
      ];
      
      sheets.push({
        name: 'Summary',
        from: { array: summaryData }
      });
      sheetsCreated++;

      // Add metadata sheet if enabled
      if (exportSettings.includeMetadata) {
        const metadataSheet = [
          ['Property', 'Value'],
          ['Chart Title', chartTitle],
          ['Chart Type', chartType],
          ['Shop Name', shopName || 'N/A'],
          ['Export Date', new Date().toISOString()],
          ['Export Time', new Date().toLocaleString()],
          ['Sheets Created', sheetsCreated],
          ['Total Data Points', processedData.length],
          ['Includes Forecasts', processedData.some((item: any) => item.isPrediction) ? 'Yes' : 'No'],
        ];
        
        sheets.push({
          name: 'Metadata',
          from: { array: metadataSheet }
        });
      }

      setProgress(90);

      // Create and download the CSV file
      const filename = `${generateFilename()}_comprehensive.csv`;
      
      // Convert sheets to CSV format
      let csvContent = '';
      
      sheets.forEach((sheet, index) => {
        if (index > 0) csvContent += '\n\n';
        csvContent += `=== ${sheet.name} ===\n`;
        
        if (sheet.from && sheet.from.array) {
          sheet.from.array.forEach((row: any[]) => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
          });
        }
      });
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setProgress(100);
      showSuccess(`CSV file exported with ${sheetsCreated + 1} sections!`);
      
      // Log audit event
      await logAuditEvent('export', 'excel', { 
        chartTitle, 
        chartType, 
        sheetsCreated: sheetsCreated + 1,
        filename 
      });

    } catch (error) {
      debugLog.error('CSV export failed:', error, 'ExportModal');
      showError('CSV export failed. Please try again or contact support.');
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