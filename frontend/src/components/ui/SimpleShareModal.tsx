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
  Alert,
  AlertTitle,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Share as ShareIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SimpleShareModalProps {
  open: boolean;
  onClose: () => void;
  chartRef: React.RefObject<HTMLDivElement>;
  chartData: any;
  chartType: string;
  chartTitle: string;
  shopName?: string;
  metrics?: {
    revenue?: number;
    orders?: number;
    conversion?: number;
    timeRange?: string;
  };
}

const SimpleShareModal: React.FC<SimpleShareModalProps> = ({
  open,
  onClose,
  chartRef,
  chartData,
  chartType,
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

  // Handle PNG export
  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(25);

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: theme.palette.background.paper,
        scale: 2, // High quality
        logging: false,
        useCORS: true,
      });

      setExportProgress(75);

      const link = document.createElement('a');
      link.download = `${chartTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExportProgress(100);
      addNotification('Chart exported as PNG successfully!', 'success');
      
      // Log the export action
      console.log('Chart export:', {
        chartTitle,
        format: 'png',
        timestamp: new Date().toISOString(),
        shop: shopName,
      });

    } catch (error) {
      console.error('Export failed:', error);
      addNotification('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, chartTitle, theme, shopName, addNotification]);

  // Handle PDF export
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
      });

      setExportProgress(50);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 297; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add title
      pdf.setFontSize(16);
      pdf.text(`${shopName} - ${chartTitle}`, 20, 20);
      
      // Add date
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 30);
      
      // Add chart
      pdf.addImage(imgData, 'PNG', 10, 40, imgWidth - 20, imgHeight - 20);
      
      // Add footer
      pdf.setFontSize(8);
      pdf.text('Powered by StoresightAI', 20, 200);
      
      setExportProgress(75);
      
      pdf.save(`${chartTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

      setExportProgress(100);
      addNotification('Chart exported as PDF successfully!', 'success');
      
    } catch (error) {
      console.error('PDF export failed:', error);
      addNotification('PDF export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, chartTitle, shopName, theme, addNotification]);

  // Handle social sharing
  const handleSocialShare = useCallback((platform: string) => {
    const message = `🎯 ${shopName} Performance Update\n\n${chartTitle} showing strong business momentum.\n\n#DataDriven #Growth #Analytics`;
    
    switch (platform) {
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(message)}`);
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(window.location.href)}`);
        break;
      case 'email':
        window.open(`mailto:?subject=${encodeURIComponent(chartTitle)}&body=${encodeURIComponent(message)}`);
        break;
      default:
        navigator.clipboard.writeText(message);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 3000);
        addNotification('Content copied to clipboard!', 'success');
        break;
    }
  }, [chartTitle, shopName, addNotification]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '400px',
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ShareIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Share Professional Chart</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Professional Sharing</AlertTitle>
          Export your charts as high-quality images or PDFs for presentations, reports, and social media.
        </Alert>

        {/* Export Options */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Export Options
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportPNG}
              disabled={isExporting}
              sx={{ minWidth: 120 }}
            >
              PNG Image
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportPDF}
              disabled={isExporting}
              sx={{ minWidth: 120 }}
            >
              PDF Report
            </Button>
          </Box>
        </Box>

        {/* Social Sharing */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Social Sharing
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={() => handleSocialShare('linkedin')}
              disabled={isExporting}
              sx={{ minWidth: 100, color: '#0077b5', borderColor: '#0077b5' }}
            >
              LinkedIn
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSocialShare('twitter')}
              disabled={isExporting}
              sx={{ minWidth: 100, color: '#1da1f2', borderColor: '#1da1f2' }}
            >
              Twitter
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSocialShare('email')}
              disabled={isExporting}
              sx={{ minWidth: 100 }}
            >
              Email
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleSocialShare('copy')}
              disabled={isExporting}
              sx={{ minWidth: 100 }}
            >
              Copy Text
            </Button>
          </Box>
        </Box>

        {/* Chart Preview Info */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: theme.palette.background.default,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
        }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Chart Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Title:</strong> {chartTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Store:</strong> {shopName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Type:</strong> {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Analytics
          </Typography>
          {metrics && (
            <Typography variant="body2" color="text.secondary">
              <strong>Period:</strong> {metrics.timeRange || '30d'}
            </Typography>
          )}
        </Box>

        {/* Export Progress */}
        {isExporting && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={exportProgress} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Exporting... {exportProgress}%
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleExportPNG}
          disabled={isExporting}
          startIcon={isExporting ? <DownloadIcon /> : <ShareIcon />}
        >
          {isExporting ? 'Exporting...' : 'Quick Export PNG'}
        </Button>
      </DialogActions>

      {/* Copy to clipboard snackbar */}
      <Snackbar
        open={copiedToClipboard}
        autoHideDuration={3000}
        onClose={() => setCopiedToClipboard(false)}
        message="Copied to clipboard!"
        action={
          <IconButton size="small" color="inherit" onClick={() => setCopiedToClipboard(false)}>
            <CheckIcon fontSize="small" />
          </IconButton>
        }
      />
    </Dialog>
  );
};

export default SimpleShareModal; 