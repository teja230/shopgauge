import React, { useState, useCallback, useMemo } from 'react';
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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Share as ShareIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  PhotoCamera as PhotoCameraIcon,
  PictureAsPdf as PdfIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SimpleShareModalProps {
  open: boolean;
  onClose: () => void;
  chartRef: React.RefObject<HTMLDivElement>;
  chartTitle: string;
  shopName?: string;
  metrics?: {
    revenue?: number;
    orders?: number;
    conversion?: number;
    timeRange?: string;
  };
}

interface ExportSettings {
  format: 'png' | 'pdf';
  quality: 'standard' | 'high';
  includeWatermark: boolean;
}

const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standard Quality' },
  { value: 'high', label: 'High Quality (2x)' },
];

const SimpleShareModal: React.FC<SimpleShareModalProps> = ({
  open,
  onClose,
  chartRef,
  chartTitle,
  shopName,
  metrics,
}) => {
  const theme = useTheme();
  const { addNotification } = useNotifications();
  
  // State management
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 'high',
    includeWatermark: true,
  });
  
  // Generate export filename
  const generateFilename = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedTitle = chartTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedShop = shopName?.replace(/[^a-zA-Z0-9]/g, '_') || 'chart';
    return `${sanitizedShop}_${sanitizedTitle}_${timestamp}`;
  }, [chartTitle, shopName]);
  
  // PNG export
  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(25);

      const scale = exportSettings.quality === 'high' ? 2 : 1;
      
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: theme.palette.background.paper,
        scale,
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
      });

      setExportProgress(75);

      const link = document.createElement('a');
      link.download = `${generateFilename()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExportProgress(100);
      addNotification('Chart exported as PNG successfully!', 'success');

    } catch (error) {
      console.error('PNG export failed:', error);
      addNotification('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, exportSettings, generateFilename, theme, addNotification]);

  // PDF export
  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(25);

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: theme.palette.background.paper,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
      });

      setExportProgress(50);

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add professional header
      pdf.setFontSize(16);
      pdf.setTextColor(40, 40, 40);
      pdf.text(`${shopName || 'Analytics'} - ${chartTitle}`, 10, 20);
      
      // Add metadata
      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 30);
      if (metrics?.timeRange) {
        pdf.text(`Period: ${metrics.timeRange}`, 10, 35);
      }
      
      // Add chart
      const yPosition = Math.min(45, pdfHeight - imgHeight - 20);
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, Math.min(imgHeight, pdfHeight - yPosition - 15));
      
      // Add footer with branding if enabled
      if (exportSettings.includeWatermark) {
        pdf.setFontSize(8);
        pdf.setTextColor(160, 160, 160);
        pdf.text('Generated with StoresightAI', 10, pdfHeight - 10);
      }
      
      setExportProgress(75);
      
      pdf.save(`${generateFilename()}.pdf`);
      setExportProgress(100);
      addNotification('Chart exported as PDF successfully!', 'success');
      
    } catch (error) {
      console.error('PDF export failed:', error);
      addNotification('PDF export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, generateFilename, shopName, chartTitle, metrics, exportSettings, theme, addNotification]);

  // Handle export
  const handleExport = useCallback(() => {
    if (exportSettings.format === 'png') {
      handleExportPNG();
    } else {
      handleExportPDF();
    }
  }, [exportSettings.format, handleExportPNG, handleExportPDF]);

  // Social sharing
  const handleSocialShare = useCallback(async (platform: string) => {
    const message = `📊 ${shopName || 'Business'} Analytics: ${chartTitle}${
      metrics?.revenue ? ` - $${metrics.revenue.toLocaleString()} revenue` : ''
    }${metrics?.orders ? ` across ${metrics.orders.toLocaleString()} orders` : ''}`;
    
    const shareableUrl = window.location.href;
    
    try {
      switch (platform) {
        case 'linkedin':
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareableUrl)}&summary=${encodeURIComponent(message)}`);
          break;
        case 'twitter':
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareableUrl)}`);
          break;
        case 'email':
          window.open(`mailto:?subject=${encodeURIComponent(`${shopName} - ${chartTitle}`)}&body=${encodeURIComponent(message + '\n\n' + shareableUrl)}`);
          break;
        case 'copy':
          await navigator.clipboard.writeText(message + '\n\n' + shareableUrl);
          setCopiedToClipboard(true);
          setTimeout(() => setCopiedToClipboard(false), 3000);
          addNotification('Link copied to clipboard!', 'success');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      addNotification('Sharing failed. Please try again.', 'error');
    }
  }, [shopName, chartTitle, metrics, addNotification]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ShareIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight={600}>
                Share Chart
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Export Settings */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Export Settings
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
              <FormControl size="small">
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportSettings.format}
                  label="Format"
                  onChange={(e) => setExportSettings(prev => ({ ...prev, format: e.target.value as 'png' | 'pdf' }))}
                >
                  <MenuItem value="png">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PhotoCameraIcon sx={{ mr: 1, fontSize: 18 }} />
                      PNG Image
                    </Box>
                  </MenuItem>
                  <MenuItem value="pdf">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PdfIcon sx={{ mr: 1, fontSize: 18 }} />
                      PDF Document
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel>Quality</InputLabel>
                <Select
                  value={exportSettings.quality}
                  label="Quality"
                  onChange={(e) => setExportSettings(prev => ({ ...prev, quality: e.target.value as 'standard' | 'high' }))}
                >
                  {QUALITY_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={exportSettings.includeWatermark}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, includeWatermark: e.target.checked }))}
                  size="small"
                />
              }
              label="Include StoresightAI branding"
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Social Sharing */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Share on Social Media
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkedInIcon />}
                onClick={() => handleSocialShare('linkedin')}
                sx={{ textTransform: 'none' }}
              >
                LinkedIn
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TwitterIcon />}
                onClick={() => handleSocialShare('twitter')}
                sx={{ textTransform: 'none' }}
              >
                Twitter
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EmailIcon />}
                onClick={() => handleSocialShare('email')}
                sx={{ textTransform: 'none' }}
              >
                Email
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={copiedToClipboard ? <CheckIcon /> : <ContentCopyIcon />}
                onClick={() => handleSocialShare('copy')}
                sx={{ textTransform: 'none' }}
                color={copiedToClipboard ? 'success' : 'primary'}
              >
                {copiedToClipboard ? 'Copied!' : 'Copy Link'}
              </Button>
            </Box>
          </Box>

          {/* Export Progress */}
          {isExporting && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Exporting chart...
              </Typography>
              <LinearProgress variant="determinate" value={exportProgress} />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isExporting}
            startIcon={<DownloadIcon />}
            sx={{ textTransform: 'none' }}
          >
            {isExporting ? 'Exporting...' : `Export ${exportSettings.format.toUpperCase()}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success notification */}
      <Snackbar
        open={copiedToClipboard}
        autoHideDuration={3000}
        onClose={() => setCopiedToClipboard(false)}
        message="Link copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default SimpleShareModal; 