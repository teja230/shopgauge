import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
  Alert,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { fetchWithAuth } from '../../api';

interface Product {
  id: string;
  title: string;
  handle?: string; // Optional for analytics endpoint
  price: number | string; // Can be number or string like "$29.99"
}

interface ProductSelectorProps {
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
  shop?: string;
  isDemoMode?: boolean;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  shop,
  isDemoMode = false
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadProducts = async () => {
    if (isDemoMode) {
      // Demo products
      const demoProducts = [
        { id: 'demo-1', title: 'Demo Product 1', handle: 'demo-product-1', price: 29.99 },
        { id: 'demo-2', title: 'Demo Product 2', handle: 'demo-product-2', price: 49.99 },
        { id: 'demo-3', title: 'Demo Product 3', handle: 'demo-product-3', price: 19.99 },
        { id: 'demo-4', title: 'Demo Product 4', handle: 'demo-product-4', price: 79.99 },
        { id: 'demo-5', title: 'Demo Product 5', handle: 'demo-product-5', price: 99.99 }
      ];
      setProducts(demoProducts);
      return;
    }

    if (!shop) {
      setError('Shop not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use the analytics products endpoint which has robust caching
      const response = await fetchWithAuth(`/api/analytics/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const productsData = data.products || data || [];
        
        // Transform analytics products to expected format
        const transformedProducts = productsData.map((product: any) => ({
          id: product.id,
          title: product.title,
          handle: product.handle || generateHandleFromTitle(product.title) || product.id, // Generate handle from title if missing
          price: typeof product.price === 'string' ? parseFloat(product.price.replace('$', '')) : product.price
        }));
        
        setProducts(transformedProducts);
        
        if (!transformedProducts.length) {
          setError('No products found in your store. Please add products to your Shopify store first.');
        }
      } else {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: 'Unknown error occurred' };
        }
        
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
      console.error('Error loading products:', err);
      setError('Failed to load products. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && products.length === 0 && !loading) {
      loadProducts();
    }
  }, [open, shop, isDemoMode]);

  const selectedProduct = products.find(p => p.id === value);

  // Helper function to generate handle from title (Shopify-style)
  const generateHandleFromTitle = (title: string): string => {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  return (
    <Box>
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={selectedProduct || null}
        onChange={(_, newValue) => {
          onChange(newValue?.id || '');
        }}
        options={products}
        getOptionLabel={(option) => `${option.title} ($${option.price})`}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Card variant="outlined" sx={{ width: '100%', mb: 1 }}>
              <CardContent sx={{ py: 2, px: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      {option.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      {option.handle ? `/${option.handle}` : 'No handle set'}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <AttachMoneyIcon style={{ fontSize: '1rem' }} color="primary" />
                      <Typography variant="body2" color="primary">
                        ${option.price}
                      </Typography>
                    </Box>
                  </Box>
                  {value === option.id && (
                    <CheckCircleIcon style={{ fontSize: '1.25rem' }} color="primary" />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Select a Shopify product (optional)"
            disabled={disabled}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                '& fieldset': {
                  borderColor: '#d1d5db',
                },
                '&:hover fieldset': {
                  borderColor: '#9ca3af',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#3b82f6',
                },
                '&.Mui-focused': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#3b82f6',
                    borderWidth: '2px',
                  },
                },
                '&:hover': {
                  backgroundColor: '#f9fafb',
                },
                transition: 'all 0.2s ease-in-out',
              },
            }}
          />
        )}
        loading={loading}
        disabled={disabled}
        clearOnBlur={false}
        clearOnEscape={false}
        noOptionsText={
          error ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {error}
            </Alert>
          ) : (
            'No products available'
          )
        }
        sx={{
          '& .MuiAutocomplete-paper': {
            maxHeight: 300,
          },
        }}
      />
      
      {selectedProduct && (
        <Box mt={1}>
          <Chip
            label={`Selected: ${selectedProduct.title}`}
            color="primary"
            variant="outlined"
            size="small"
            onDelete={() => onChange('')}
          />
        </Box>
      )}
    </Box>
  );
}; 