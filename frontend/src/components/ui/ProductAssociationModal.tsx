import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  AttachMoney as AttachMoneyIcon,
  Inventory as InventoryIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { fetchWithAuth } from '../../api';

interface Product {
  id: string;
  title: string;
  handle: string;
  price: number;
}

interface ProductAssociationModalProps {
  open: boolean;
  onClose: () => void;
  competitorId: string;
  competitorUrl: string;
  competitorLabel: string;
  currentProductId?: string;
  currentProductTitle?: string;
  onAssociationChange: () => void;
  isDemoMode?: boolean;
}

const ProductCard = styled(Card)<{ selected: boolean }>(({ theme, selected }) => ({
  marginBottom: theme.spacing(2),
  border: `2px solid ${selected ? theme.palette.primary.main : '#e5e7eb'}`,
  borderRadius: 16,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  backgroundColor: selected ? '#f0f9ff' : '#ffffff',
  boxShadow: selected ? '0 4px 12px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    boxShadow: '0 8px 25px rgba(59, 130, 246, 0.15)',
    transform: 'translateY(-1px)',
  },
  ...(selected && {
    backgroundColor: '#f0f9ff',
    borderColor: theme.palette.primary.main,
  }),
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  position: 'sticky',
  top: 0,
  backgroundColor: '#ffffff',
  zIndex: 1,
  padding: theme.spacing(2, 0),
  borderBottom: '1px solid #f3f4f6',
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
    border: '1px solid #e5e7eb',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  },
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
  color: 'white',
  padding: theme.spacing(3),
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
    borderRadius: 'inherit',
  },
}));

const ContentSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#ffffff',
  maxHeight: '70vh',
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f5f9',
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#cbd5e1',
    borderRadius: 4,
    '&:hover': {
      background: '#94a3b8',
    },
  },
}));

const ActionSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e5e7eb',
  borderBottomLeftRadius: 20,
  borderBottomRightRadius: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

export const ProductAssociationModal: React.FC<ProductAssociationModalProps> = ({
  open,
  onClose,
  competitorId,
  competitorUrl,
  competitorLabel,
  currentProductId,
  currentProductTitle,
  onAssociationChange,
  isDemoMode = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(currentProductId);
  const [associating, setAssociating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load available products when modal opens
  useEffect(() => {
    if (open && competitorId) {
      loadAvailableProducts();
    }
  }, [open, competitorId]);

  // Update selected product when current product changes
  useEffect(() => {
    setSelectedProductId(currentProductId);
  }, [currentProductId]);

  const loadAvailableProducts = async () => {
    setLoading(true);
    setError(null);
    
    if (isDemoMode) {
      // In demo mode, skip API call entirely and show demo products
      console.log('Demo mode: Loading demo products');
      const demoProducts = [
        { id: 'demo-1', title: 'Demo Product 1', handle: 'demo-product-1', price: 29.99 },
        { id: 'demo-2', title: 'Demo Product 2', handle: 'demo-product-2', price: 49.99 },
        { id: 'demo-3', title: 'Demo Product 3', handle: 'demo-product-3', price: 19.99 }
      ];
      setProducts(demoProducts);
      setLoading(false);
      return;
    }
    
    try {
      console.log(`Loading products for competitor ${competitorId}`);
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/products`);
      
      console.log(`Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Products data received:', data);
        setProducts(data.products || []);
        
        if (!data.products || data.products.length === 0) {
          setError('No products found in your store. Please add products to your Shopify store first, then try again.');
        }
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorData = { error: 'Unknown error occurred' };
        }
        
        console.error('API error:', errorData);
        
        // Provide more specific error messages based on the error
        let errorMessage = 'Failed to load products. Please try again.';
        
        if (errorData.error) {
          if (errorData.error.includes('Shopify authentication') || errorData.error.includes('Authentication required')) {
            errorMessage = 'Shopify connection required. Please reconnect your store in the dashboard.';
          } else if (errorData.error.includes('No products found') || errorData.error.includes('No products available')) {
            errorMessage = 'No products found in your store. Please add products to your Shopify store first.';
          } else if (errorData.error.includes('sync') || errorData.error.includes('PRODUCTS_SYNC_NEEDED')) {
            errorMessage = 'Products need to be synced. Please visit the dashboard to sync your products.';
          } else if (errorData.error.includes('Failed to connect to Shopify')) {
            errorMessage = 'Unable to connect to Shopify. Please check your internet connection and try again.';
          } else {
            errorMessage = errorData.error;
          }
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Network error loading products:', err);
      setError('Connection issue. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssociate = async () => {
    if (!selectedProductId) return;
    
    setAssociating(true);
    setError(null);
    setSuccess(null);
    
    if (isDemoMode) {
      // In demo mode, simulate successful association
      setSuccess('Demo product associated successfully');
      onAssociationChange();
      setTimeout(() => {
        onClose();
      }, 1500);
      setAssociating(false);
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/associate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: selectedProductId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'Product associated successfully');
        onAssociationChange();
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to associate product');
      }
    } catch (err) {
      setError('Network error while associating product');
    } finally {
      setAssociating(false);
    }
  };

  const handleDisassociate = async () => {
    setAssociating(true);
    setError(null);
    setSuccess(null);
    
    if (isDemoMode) {
      // In demo mode, simulate successful disassociation
      setSuccess('Demo association removed successfully');
      setSelectedProductId(undefined);
      onAssociationChange();
      setTimeout(() => {
        onClose();
      }, 1500);
      setAssociating(false);
      return;
    }
    
    try {
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/disassociate`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'Product association removed');
        setSelectedProductId(undefined);
        onAssociationChange();
        // Close modal after a short delay to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove association');
      }
    } catch (err) {
      setError('Network error while removing association');
    } finally {
      setAssociating(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.handle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 20,
          maxHeight: isMobile ? '100%' : '90vh',
          overflow: 'hidden',
        },
      }}
    >
      <HeaderSection>
        <Box display="flex" alignItems="center" justifyContent="space-between" position="relative" zIndex={1}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <LinkIcon sx={{ fontSize: 24, color: '#f1f5f9' }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="600" sx={{ color: '#f1f5f9' }}>
                Product Association
              </Typography>
              <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                Link competitor to your Shopify product
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ 
              color: '#f1f5f9',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Box mt={2} position="relative" zIndex={1}>
          <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1 }}>
            Competitor Details
          </Typography>
          <Box sx={{ 
            p: 2, 
            borderRadius: 2, 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Typography variant="body1" fontWeight="500" sx={{ color: '#f1f5f9' }}>
              {competitorLabel}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8' }}>
              {new URL(competitorUrl).hostname}
            </Typography>
          </Box>
        </Box>
      </HeaderSection>

      <ContentSection>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Box display="flex" gap={1}>
                {error.includes('Shopify') && (
                  <Button 
                    color="inherit" 
                    size="small" 
                    variant="outlined"
                    onClick={() => window.open('/dashboard', '_blank')}
                  >
                    Go to Dashboard
                  </Button>
                )}
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={loadAvailableProducts}
                  disabled={loading}
                >
                  Retry
                </Button>
              </Box>
            }
          >
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Current Association */}
        {currentProductId && currentProductTitle && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="600" color="#374151" gutterBottom>
              Currently Linked Product
            </Typography>
            <Card sx={{ 
              border: '2px solid #10b981',
              backgroundColor: '#f0fdf4',
              borderRadius: 3,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
            }}>
              <CardContent sx={{ py: 2.5 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body1" fontWeight="600" color="#065f46" gutterBottom>
                      {currentProductTitle}
                    </Typography>
                    <Chip 
                      icon={<CheckCircleIcon />}
                      label="Successfully Linked"
                      sx={{ 
                        backgroundColor: '#10b981',
                        color: 'white',
                        fontWeight: 500,
                        '& .MuiChip-icon': {
                          color: 'white'
                        }
                      }}
                      size="small"
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<UnlinkIcon />}
                    onClick={handleDisassociate}
                    disabled={associating}
                    sx={{
                      borderColor: '#ef4444',
                      color: '#ef4444',
                      '&:hover': {
                        borderColor: '#dc2626',
                        backgroundColor: '#fef2f2'
                      }
                    }}
                  >
                    Unlink
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Product Selection */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="600" color="#374151" gutterBottom>
            {currentProductId ? 'Change Product Association' : 'Select Product to Link'}
          </Typography>
          
          {!loading && products.length === 0 && !error && !isDemoMode && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>No products found</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                To link competitors to products, you need to add products to your Shopify store first. 
                Visit your Shopify admin to add products, then return here to link them.
              </Typography>
            </Alert>
          )}
          
          <SearchContainer>
            <TextField
              fullWidth
              placeholder="Search products by name or handle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#6b7280' }} />
                  </InputAdornment>
                ),
              }}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  backgroundColor: '#f9fafb',
                  '&:hover': {
                    backgroundColor: '#f3f4f6',
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                  },
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#e5e7eb',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#d1d5db',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#3b82f6',
                },
              }}
            />
          </SearchContainer>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredProducts.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? 'No products match your search. Try a different search term.' : (isDemoMode ? 'No demo products available.' : 'No products available in your store. Please add products to your Shopify store first.')}
            </Alert>
          ) : (
            <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  selected={selectedProductId === product.id}
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <CardActionArea>
                    <CardContent sx={{ py: 2.5 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box flex={1}>
                          <Typography variant="body1" fontWeight="600" color="#1f2937" gutterBottom>
                            {product.title}
                          </Typography>
                          <Typography variant="body2" color="#6b7280" gutterBottom sx={{ fontFamily: 'monospace' }}>
                            /{product.handle}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <AttachMoneyIcon fontSize="small" sx={{ color: '#059669' }} />
                            <Typography variant="body2" fontWeight="500" sx={{ color: '#059669' }}>
                              ${product.price}
                            </Typography>
                          </Box>
                        </Box>
                        {selectedProductId === product.id && (
                          <Box sx={{ 
                            p: 1, 
                            borderRadius: 2, 
                            backgroundColor: '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} />
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </ProductCard>
              ))}
            </Box>
          )}
        </Box>
      </ContentSection>

      <ActionSection>
        <Button 
          onClick={onClose} 
          disabled={associating}
          variant="outlined"
          sx={{ 
            borderColor: '#d1d5db',
            color: '#374151',
            '&:hover': { 
              borderColor: '#9ca3af',
              backgroundColor: '#f9fafb'
            }
          }}
        >
          Cancel
        </Button>
        {selectedProductId && selectedProductId !== currentProductId && (
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={associating}
            startIcon={associating ? <CircularProgress size={16} /> : <LinkIcon />}
            sx={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                boxShadow: '0 6px 16px rgba(59, 130, 246, 0.4)',
              },
              '&:disabled': {
                background: '#9ca3af',
                boxShadow: 'none',
              }
            }}
          >
            {associating ? 'Linking...' : 'Link Product'}
          </Button>
        )}
      </ActionSection>
    </StyledDialog>
  );
}; 