import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActionArea,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  Avatar,
  Tooltip,
  Collapse,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ButtonGroup,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Share as ShareIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Preview as PreviewIcon,
  Palette as PaletteIcon,
  BusinessCenter as BusinessIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  Email as EmailIcon,
  PhotoCamera as PhotoCameraIcon,
  PictureAsPdf as PdfIcon,
  GetApp as GetAppIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudUpload as CloudUploadIcon,
  AutoAwesome as AutoAwesomeIcon,
  TrendingUp as TrendingUpIcon,
  Analytics as AnalyticsIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as ContentCopyIcon,
  FileDownload as FileDownloadIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useNotifications } from '../../hooks/useNotifications';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  ExecutiveSummaryTemplate,
  SocialCelebrationTemplate,
  InvestorUpdateTemplate,
  MarketingInsightsTemplate,
  MinimalProfessionalTemplate,
} from './templates/ProfessionalChartTemplates';

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

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'professional' | 'social' | 'executive';
  premium?: boolean;
  component: React.ComponentType<any>;
  preview: string;
}

interface ExportSettings {
  format: 'png' | 'pdf' | 'svg' | 'jpeg';
  quality: 'standard' | 'high' | 'ultra';
  size: 'small' | 'medium' | 'large' | 'custom';
  includeWatermark: boolean;
  includeMetadata: boolean;
  customWidth?: number;
  customHeight?: number;
}

interface BrandSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  companyLogo?: string;
  companyName?: string;
  showBranding: boolean;
}

const TEMPLATES: Template[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'Professional template for executive presentations',
    icon: <BusinessIcon />,
    category: 'executive',
    component: ExecutiveSummaryTemplate,
    preview: '/api/placeholder/300/200',
  },
  {
    id: 'social',
    name: 'Social Celebration',
    description: 'Eye-catching template for social media sharing',
    icon: <AutoAwesomeIcon />,
    category: 'social',
    component: SocialCelebrationTemplate,
    preview: '/api/placeholder/300/200',
  },
  {
    id: 'investor',
    name: 'Investor Update',
    description: 'Clean, professional template for investor communications',
    icon: <TrendingUpIcon />,
    category: 'executive',
    premium: true,
    component: InvestorUpdateTemplate,
    preview: '/api/placeholder/300/200',
  },
  {
    id: 'marketing',
    name: 'Marketing Insights',
    description: 'Branded template for marketing reports and insights',
    icon: <AnalyticsIcon />,
    category: 'professional',
    component: MarketingInsightsTemplate,
    preview: '/api/placeholder/300/200',
  },
  {
    id: 'minimal',
    name: 'Minimal Professional',
    description: 'Clean, minimal template for professional use',
    icon: <StarBorderIcon />,
    category: 'professional',
    component: MinimalProfessionalTemplate,
    preview: '/api/placeholder/300/200',
  },
];

const EXPORT_FORMATS = [
  { value: 'png', label: 'PNG Image', icon: <PhotoCameraIcon />, description: 'High quality raster image' },
  { value: 'pdf', label: 'PDF Document', icon: <PdfIcon />, description: 'Professional document format' },
  { value: 'jpeg', label: 'JPEG Image', icon: <PhotoCameraIcon />, description: 'Compressed image format' },
  { value: 'svg', label: 'SVG Vector', icon: <GetAppIcon />, description: 'Scalable vector format' },
];

const QUALITY_SETTINGS = [
  { value: 'standard', label: 'Standard (1x)', description: 'Good for web sharing' },
  { value: 'high', label: 'High (2x)', description: 'Better for presentations' },
  { value: 'ultra', label: 'Ultra (4x)', description: 'Best for print' },
];

const SIZE_PRESETS = [
  { value: 'small', label: 'Small (800x600)', width: 800, height: 600 },
  { value: 'medium', label: 'Medium (1200x800)', width: 1200, height: 800 },
  { value: 'large', label: 'Large (1920x1080)', width: 1920, height: 1080 },
  { value: 'custom', label: 'Custom Size', width: 0, height: 0 },
];

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
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Export settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 'high',
    size: 'medium',
    includeWatermark: true,
    includeMetadata: true,
  });
  
  // Brand settings
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    primaryColor: theme.palette.primary.main,
    secondaryColor: theme.palette.secondary.main,
    accentColor: theme.palette.success.main,
    companyName: shopName || 'Your Store',
    showBranding: true,
  });
  
  // Template preview ref
  const templatePreviewRef = useRef<HTMLDivElement>(null);
  
  // Memoized chart component for templates
  const chartComponent = useMemo(() => {
    if (!chartRef.current) return null;
    return React.cloneElement(chartRef.current as any);
  }, [chartRef]);
  
  // Handle template selection
  const handleTemplateSelect = useCallback((template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  }, []);
  
  // Handle export settings change
  const handleExportSettingChange = useCallback((key: keyof ExportSettings, value: any) => {
    setExportSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Handle brand settings change
  const handleBrandSettingChange = useCallback((key: keyof BrandSettings, value: any) => {
    setBrandSettings(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Generate export filename
  const generateFilename = useCallback(() => {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedTitle = chartTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedShop = shopName?.replace(/[^a-zA-Z0-9]/g, '_') || 'chart';
    return `${sanitizedShop}_${sanitizedTitle}_${selectedTemplate.id}_${timestamp}`;
  }, [chartTitle, shopName, selectedTemplate.id]);
  
  // Enhanced PNG export with template
  const handleExportPNG = useCallback(async () => {
    const targetRef = showPreview ? templatePreviewRef : chartRef;
    if (!targetRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(25);

      const sizePreset = SIZE_PRESETS.find(s => s.value === exportSettings.size);
      const qualityMultiplier = exportSettings.quality === 'ultra' ? 4 : 
                               exportSettings.quality === 'high' ? 2 : 1;
      
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: theme.palette.background.paper,
        scale: qualityMultiplier,
        logging: false,
        useCORS: true,
        width: sizePreset?.width || undefined,
        height: sizePreset?.height || undefined,
        allowTaint: true,
        foreignObjectRendering: true,
      });

      setExportProgress(75);

      const link = document.createElement('a');
      link.download = `${generateFilename()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExportProgress(100);
      addNotification('Chart exported successfully!', 'success');
      
      // Track export analytics
      console.log('Export analytics:', {
        template: selectedTemplate.id,
        format: 'png',
        quality: exportSettings.quality,
        size: exportSettings.size,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Export failed:', error);
      addNotification('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, templatePreviewRef, showPreview, exportSettings, selectedTemplate, generateFilename, theme, addNotification]);

  // Enhanced PDF export with professional layout
  const handleExportPDF = useCallback(async () => {
    const targetRef = showPreview ? templatePreviewRef : chartRef;
    if (!targetRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      setExportProgress(25);

      const canvas = await html2canvas(targetRef.current, {
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
      pdf.setFontSize(18);
      pdf.setTextColor(40, 40, 40);
      pdf.text(`${shopName} - ${chartTitle}`, 20, 20);
      
      // Add metadata
      pdf.setFontSize(10);
      pdf.setTextColor(120, 120, 120);
      pdf.text(`Template: ${selectedTemplate.name}`, 20, 30);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
      pdf.text(`Period: ${metrics?.timeRange || '30d'}`, 20, 40);
      
      // Add chart
      const yPosition = Math.min(50, pdfHeight - imgHeight - 30);
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, Math.min(imgHeight, pdfHeight - yPosition - 20));
      
      // Add footer with branding
      if (exportSettings.includeWatermark) {
      pdf.setFontSize(8);
        pdf.setTextColor(160, 160, 160);
        pdf.text('Generated with StoresightAI', 20, pdfHeight - 10);
      }
      
      setExportProgress(75);
      
      pdf.save(`${generateFilename()}.pdf`);
      setExportProgress(100);
      addNotification('PDF exported successfully!', 'success');
      
    } catch (error) {
      console.error('PDF export failed:', error);
      addNotification('PDF export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  }, [chartRef, templatePreviewRef, showPreview, selectedTemplate, generateFilename, shopName, chartTitle, metrics, exportSettings, theme, addNotification]);

  // Enhanced social sharing with analytics
  const handleSocialShare = useCallback(async (platform: string) => {
    const message = `🎯 ${shopName} Performance Update\n\n${chartTitle} showing ${
      metrics?.revenue ? `$${metrics.revenue.toLocaleString()} revenue` : 'strong growth'
    }${metrics?.orders ? ` across ${metrics.orders.toLocaleString()} orders` : ''}.\n\n#DataDriven #Growth #Analytics #${shopName?.replace(/\s+/g, '')}`;
    
    // Generate shareable link (in production, this would be a real URL)
    const shareableUrl = `${window.location.origin}/share/${generateFilename()}`;
    
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
  }, [shopName, chartTitle, metrics, generateFilename, addNotification]);
  
  // Handle logo upload
  const handleLogoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBrandSettings(prev => ({ ...prev, companyLogo: e.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, []);
  
  // Render template preview
  const renderTemplatePreview = () => {
    if (!showPreview || !selectedTemplate) return null;
    
    const TemplateComponent = selectedTemplate.component;
    return (
      <Box ref={templatePreviewRef} sx={{ width: '100%', minHeight: 400 }}>
        <TemplateComponent
          title={chartTitle}
          shopName={brandSettings.companyName || shopName || 'Your Store'}
          chartComponent={chartComponent}
          metrics={metrics}
          showWatermark={exportSettings.includeWatermark}
          companyLogo={brandSettings.companyLogo}
          brandColors={{
            primary: brandSettings.primaryColor,
            secondary: brandSettings.secondaryColor,
            accent: brandSettings.accentColor,
          }}
        />
      </Box>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          maxHeight: '90vh',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ShareIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={600}>
              Professional Chart Sharing
            </Typography>
            <Chip
              icon={<AutoAwesomeIcon />}
              label="Enhanced"
              color="primary"
              size="small"
              sx={{ ml: 2 }}
            />
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} centered>
            <Tab 
              icon={<PreviewIcon />} 
              label="Templates" 
              sx={{ minHeight: 64 }}
            />
            <Tab 
              icon={<TuneIcon />} 
              label="Export Settings" 
              sx={{ minHeight: 64 }}
            />
            <Tab 
              icon={<PaletteIcon />} 
              label="Brand Customization" 
              sx={{ minHeight: 64 }}
            />
            <Tab 
              icon={<ShareIcon />} 
              label="Share & Export" 
              sx={{ minHeight: 64 }}
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Templates Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Choose a Professional Template
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select a template that matches your sharing purpose and audience
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
                gap: 2 
              }}>
                {TEMPLATES.map((template) => (
                  <Card 
                    key={template.id}
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedTemplate.id === template.id ? 2 : 1,
                      borderColor: selectedTemplate.id === template.id ? 'primary.main' : 'divider',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4,
                      }
                    }}
                  >
                    <CardActionArea onClick={() => handleTemplateSelect(template)}>
                      <Box sx={{ p: 2, height: 120, display: 'flex', alignItems: 'center' }}>
                        <Avatar 
                          sx={{ 
                            bgcolor: template.category === 'executive' ? 'primary.main' : 
                                    template.category === 'social' ? 'secondary.main' : 'success.main',
                            mr: 2,
                            width: 48,
                            height: 48,
                          }}
                        >
                          {template.icon}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {template.name}
                            </Typography>
                            {template.premium && (
                              <Chip 
                                label="Pro" 
                                color="warning" 
                                size="small" 
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                        </Box>
                      </Box>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
              
              {/* Template Preview */}
              <Collapse in={showPreview} sx={{ mt: 3 }}>
                <Card sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      Preview: {selectedTemplate.name}
                    </Typography>
                    <Button
                      startIcon={showPreview ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      onClick={() => setShowPreview(!showPreview)}
                      size="small"
                    >
                      {showPreview ? 'Hide' : 'Show'} Preview
                    </Button>
                  </Box>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    {renderTemplatePreview()}
                  </Paper>
                </Card>
              </Collapse>
            </Box>
          )}

          {/* Export Settings Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Export Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Customize your export settings for optimal quality and file size
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 3 
              }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Format & Quality
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Export Format</InputLabel>
                    <Select
                      value={exportSettings.format}
                      onChange={(e) => handleExportSettingChange('format', e.target.value)}
                      label="Export Format"
                    >
                      {EXPORT_FORMATS.map((format) => (
                        <MenuItem key={format.value} value={format.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {format.icon}
                            <Box sx={{ ml: 1 }}>
                              <Typography variant="body2">{format.label}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {format.description}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Quality</InputLabel>
                    <Select
                      value={exportSettings.quality}
                      onChange={(e) => handleExportSettingChange('quality', e.target.value)}
                      label="Quality"
                    >
                      {QUALITY_SETTINGS.map((quality) => (
                        <MenuItem key={quality.value} value={quality.value}>
                          <Box>
                            <Typography variant="body2">{quality.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {quality.description}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Size & Options
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Size Preset</InputLabel>
                    <Select
                      value={exportSettings.size}
                      onChange={(e) => handleExportSettingChange('size', e.target.value)}
                      label="Size Preset"
                    >
                      {SIZE_PRESETS.map((size) => (
                        <MenuItem key={size.value} value={size.value}>
                          {size.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportSettings.includeWatermark}
                        onChange={(e) => handleExportSettingChange('includeWatermark', e.target.checked)}
                      />
                    }
                    label="Include StoresightAI watermark"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={exportSettings.includeMetadata}
                        onChange={(e) => handleExportSettingChange('includeMetadata', e.target.checked)}
                      />
                    }
                    label="Include chart metadata"
                  />
                </Box>
              </Box>
            </Box>
          )}

          {/* Brand Customization Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Brand Customization
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Customize colors and branding to match your company identity
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 3 
              }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Brand Colors
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Primary Color</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: brandSettings.primaryColor,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'color';
                          input.value = brandSettings.primaryColor;
                          input.onchange = (e) => handleBrandSettingChange('primaryColor', (e.target as HTMLInputElement).value);
                          input.click();
                        }}
                      />
                      <TextField
                        value={brandSettings.primaryColor}
                        onChange={(e) => handleBrandSettingChange('primaryColor', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Secondary Color</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: brandSettings.secondaryColor,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'color';
                          input.value = brandSettings.secondaryColor;
                          input.onchange = (e) => handleBrandSettingChange('secondaryColor', (e.target as HTMLInputElement).value);
                          input.click();
                        }}
                      />
                      <TextField
                        value={brandSettings.secondaryColor}
                        onChange={(e) => handleBrandSettingChange('secondaryColor', e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    Company Information
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={brandSettings.companyName}
                    onChange={(e) => handleBrandSettingChange('companyName', e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>Company Logo</Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUploadIcon />}
                      fullWidth
                      sx={{ mb: 1 }}
                    >
                      Upload Logo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </Button>
                    {brandSettings.companyLogo && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <img 
                          src={brandSettings.companyLogo} 
                          alt="Company Logo" 
                          style={{ height: 40, objectFit: 'contain' }}
                        />
                        <Button 
                          size="small" 
                          onClick={() => handleBrandSettingChange('companyLogo', undefined)}
                        >
                          Remove
                        </Button>
                      </Box>
                    )}
                  </Box>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={brandSettings.showBranding}
                        onChange={(e) => handleBrandSettingChange('showBranding', e.target.checked)}
                      />
                    }
                    label="Show company branding"
                  />
                </Box>
              </Box>
            </Box>
          )}

          {/* Share & Export Tab */}
          {activeTab === 3 && (
            <Box>
          <Typography variant="h6" gutterBottom>
                Share & Export Your Chart
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Export your professionally formatted chart or share it on social media
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 3 
              }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Export Options
          </Typography>
                  
                  <ButtonGroup orientation="vertical" fullWidth sx={{ mb: 2 }}>
            <Button
              variant="contained"
                      startIcon={<FileDownloadIcon />}
              onClick={handleExportPNG}
              disabled={isExporting}
                      size="large"
                      sx={{ justifyContent: 'flex-start', py: 1.5 }}
            >
                      Export as {exportSettings.format.toUpperCase()}
            </Button>
            <Button
              variant="outlined"
                      startIcon={<PdfIcon />}
              onClick={handleExportPDF}
              disabled={isExporting}
                      size="large"
                      sx={{ justifyContent: 'flex-start', py: 1.5 }}
            >
                      Export as PDF Report
            </Button>
                  </ButtonGroup>
                  
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
                      Export Preview
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Template: {selectedTemplate.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Format: {exportSettings.format.toUpperCase()} ({exportSettings.quality})
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Size: {SIZE_PRESETS.find(s => s.value === exportSettings.size)?.label}
                    </Typography>
          </Box>
        </Box>

                <Box>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Social Sharing
          </Typography>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(2, 1fr)', 
                    gap: 2 
                  }}>
            <Button
              variant="outlined"
                      startIcon={<LinkedInIcon />}
              onClick={() => handleSocialShare('linkedin')}
              disabled={isExporting}
                      fullWidth
                      sx={{ 
                        py: 1.5,
                        color: '#0077b5', 
                        borderColor: '#0077b5',
                        '&:hover': { bgcolor: 'rgba(0, 119, 181, 0.1)' }
                      }}
            >
              LinkedIn
            </Button>
            <Button
              variant="outlined"
                      startIcon={<TwitterIcon />}
              onClick={() => handleSocialShare('twitter')}
              disabled={isExporting}
                      fullWidth
                      sx={{ 
                        py: 1.5,
                        color: '#1da1f2', 
                        borderColor: '#1da1f2',
                        '&:hover': { bgcolor: 'rgba(29, 161, 242, 0.1)' }
                      }}
            >
              Twitter
            </Button>
            <Button
              variant="outlined"
                      startIcon={<EmailIcon />}
              onClick={() => handleSocialShare('email')}
              disabled={isExporting}
                      fullWidth
                      sx={{ py: 1.5 }}
            >
              Email
            </Button>
            <Button
              variant="outlined"
                      startIcon={<ContentCopyIcon />}
              onClick={() => handleSocialShare('copy')}
              disabled={isExporting}
                      fullWidth
                      sx={{ py: 1.5 }}
            >
                      Copy Link
            </Button>
        </Box>

        <Box sx={{ 
                    mt: 2,
          p: 2, 
                    bgcolor: 'primary.50', 
          borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'primary.200',
        }}>
                    <Typography variant="body2" fontWeight={600} gutterBottom>
            Chart Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Title:</strong> {chartTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
                      <strong>Store:</strong> {brandSettings.companyName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
                      <strong>Period:</strong> {metrics?.timeRange || '30d'}
          </Typography>
                    {metrics?.revenue && (
            <Typography variant="body2" color="text.secondary">
                        <strong>Revenue:</strong> ${metrics.revenue.toLocaleString()}
            </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Export Progress */}
        {isExporting && (
          <Box sx={{ px: 3, pb: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={exportProgress} 
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              Exporting your professional chart... {exportProgress}%
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} size="large">
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleExportPNG}
          disabled={isExporting}
          startIcon={isExporting ? <CircularProgress size={20} /> : <GetAppIcon />}
          size="large"
        >
          {isExporting ? 'Exporting...' : 'Quick Export'}
        </Button>
      </DialogActions>

      {/* Success Snackbar */}
      <Snackbar
        open={copiedToClipboard}
        autoHideDuration={3000}
        onClose={() => setCopiedToClipboard(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setCopiedToClipboard(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          Link copied to clipboard!
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default SimpleShareModal; 