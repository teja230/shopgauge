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
  border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: 12,
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.palette.primary.light,
    boxShadow: theme.shadows[4],
  },
  ...(selected && {
    backgroundColor: theme.palette.primary.light + '10',
  }),
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  position: 'sticky',
  top: 0,
  backgroundColor: theme.palette.background.paper,
  zIndex: 1,
  padding: theme.spacing(2, 0),
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
    
    try {
      console.log(`Loading products for competitor ${competitorId}, demo mode: ${isDemoMode}`);
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/products?isDemoMode=${isDemoMode}`);
      
      console.log(`Response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Products data received:', data);
        setProducts(data.products || []);
        
        if (!data.products || data.products.length === 0) {
          if (isDemoMode) {
            // Show demo products when API fails in demo mode
            const demoProducts = [
              { id: 'demo-1', title: 'Demo Product 1', handle: 'demo-product-1', price: 29.99 },
              { id: 'demo-2', title: 'Demo Product 2', handle: 'demo-product-2', price: 49.99 },
              { id: 'demo-3', title: 'Demo Product 3', handle: 'demo-product-3', price: 19.99 }
            ];
            setProducts(demoProducts);
            setError(null);
          } else {
            setError('No products available for association. Please sync your products first.');
          }
        }
      } else {
        const errorData = await response.json();
        console.error('API error:', errorData);
        
        if (isDemoMode) {
          // In demo mode, show demo products even if API fails
          const demoProducts = [
            { id: 'demo-1', title: 'Demo Product 1', handle: 'demo-product-1', price: 29.99 },
            { id: 'demo-2', title: 'Demo Product 2', handle: 'demo-product-2', price: 49.99 },
            { id: 'demo-3', title: 'Demo Product 3', handle: 'demo-product-3', price: 19.99 }
          ];
          setProducts(demoProducts);
          setError(null);
        } else {
          setError(errorData.error || 'Failed to load products. Please try again or sync your products first.');
        }
      }
    } catch (err) {
      console.error('Network error loading products:', err);
      setError('Network error while loading products');
    } finally {
      setLoading(false);
    }
  };

  const handleAssociate = async () => {
    if (!selectedProductId) return;
    
    setAssociating(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/associate?isDemoMode=${isDemoMode}`, {
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
    
    try {
      const response = await fetchWithAuth(`/api/competitors/${competitorId}/disassociate?isDemoMode=${isDemoMode}`, {
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? '100%' : '90vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <LinkIcon color="primary" />
            <Typography variant="h6">
              Link Competitor to Product
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {competitorLabel} • {new URL(competitorUrl).hostname}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 0 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={loadAvailableProducts}
                disabled={loading}
              >
                Retry
              </Button>
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
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Currently Linked
            </Typography>
            <Card sx={{ 
              border: `2px solid ${theme.palette.success.main}`,
              backgroundColor: theme.palette.success.light + '10',
            }}>
              <CardContent sx={{ py: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {currentProductTitle}
                    </Typography>
                    <Chip 
                      icon={<CheckCircleIcon />}
                      label="Linked"
                      color="success"
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<UnlinkIcon />}
                    onClick={handleDisassociate}
                    disabled={associating}
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
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {currentProductId ? 'Change Association' : 'Select Product to Link'}
          </Typography>
          
          <SearchContainer>
            <TextField
              fullWidth
              placeholder="Search products by name or handle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </SearchContainer>

          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : filteredProducts.length === 0 ? (
            <Alert severity="info">
              {searchTerm ? 'No products match your search' : 'No products available'}
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
                    <CardContent sx={{ py: 2 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box flex={1}>
                          <Typography variant="body1" fontWeight="medium" gutterBottom>
                            {product.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            /{product.handle}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <AttachMoneyIcon fontSize="small" color="primary" />
                            <Typography variant="body2" color="primary">
                              ${product.price}
                            </Typography>
                          </Box>
                        </Box>
                        {selectedProductId === product.id && (
                          <CheckCircleIcon color="primary" />
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </ProductCard>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={associating}>
          Cancel
        </Button>
        {selectedProductId && selectedProductId !== currentProductId && (
          <Button
            variant="contained"
            onClick={handleAssociate}
            disabled={associating}
            startIcon={associating ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            {associating ? 'Linking...' : 'Link Product'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}; 