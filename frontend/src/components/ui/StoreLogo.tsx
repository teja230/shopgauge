import React from 'react';
import { Avatar, Box, SvgIcon } from '@mui/material';

// Store logo mapping
const STORE_LOGOS: Record<string, React.ReactElement> = {
  // Amazon - Shopping cart with arrow
  'amazon.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"
      />
    </SvgIcon>
  ),
  
  // Best Buy - Electronics icon
  'bestbuy.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5l-1 3h2l1-3h4l1 3h2l-1-3h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H3V5h18v10z"
      />
    </SvgIcon>
  ),
  
  // Target - Target/bullseye icon
  'target.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <circle cx="12" cy="12" r="6" fill="white" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </SvgIcon>
  ),
  
  // Walmart - Store icon
  'walmart.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </SvgIcon>
  ),
  
  // eBay - Auction hammer
  'ebay.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </SvgIcon>
  ),
  
  // Etsy - Handmade icon
  'etsy.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </SvgIcon>
  ),
  
  // Shopify - Shopping bag
  'myshopify.com': (
    <SvgIcon viewBox="0 0 24 24" sx={{ width: '100%', height: '100%' }}>
      <path
        fill="currentColor"
        d="M19 7h-3V6c0-1.7-1.3-3-3-3h-2C9.3 3 8 4.3 8 6v1H5c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 6c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v1h-4V6z"
      />
    </SvgIcon>
  ),
};

// Store color mapping
const STORE_COLORS: Record<string, string> = {
  'amazon.com': '#FF9900',
  'bestbuy.com': '#003087',
  'target.com': '#CC0000',
  'walmart.com': '#007DC6',
  'ebay.com': '#86B817',
  'etsy.com': '#F56400',
  'myshopify.com': '#95BF47',
};

// Store name mapping
const STORE_NAMES: Record<string, string> = {
  'amazon.com': 'Amazon',
  'bestbuy.com': 'Best Buy',
  'target.com': 'Target',
  'walmart.com': 'Walmart',
  'ebay.com': 'eBay',
  'etsy.com': 'Etsy',
  'myshopify.com': 'Shopify',
};

interface StoreLogoProps {
  url: string;
  size?: number;
  fallbackToInitials?: boolean;
  label?: string;
}

export const StoreLogo: React.FC<StoreLogoProps> = ({ 
  url, 
  size = 32, 
  fallbackToInitials = true,
  label 
}) => {
  const domain = getDomainFromUrl(url);
  const storeLogo = STORE_LOGOS[domain];
  const storeColor = STORE_COLORS[domain];
  const storeName = STORE_NAMES[domain];

  // If we have a store logo, use it
  if (storeLogo) {
    return (
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: storeColor || 'primary.main',
          color: 'white',
          fontSize: `${size * 0.4}px`,
          fontWeight: 600,
        }}
      >
        {storeLogo}
      </Avatar>
    );
  }

  // Fallback to initials if enabled
  if (fallbackToInitials && label) {
    const initials = getCompetitorInitials(label);
    return (
      <Avatar
        sx={{
          width: size,
          height: size,
          bgcolor: 'primary.main',
          fontSize: `${size * 0.4}px`,
          fontWeight: 600,
        }}
      >
        {initials}
      </Avatar>
    );
  }

  // Final fallback - generic store icon
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        bgcolor: 'grey.500',
        fontSize: `${size * 0.4}px`,
        fontWeight: 600,
      }}
    >
      <SvgIcon viewBox="0 0 24 24" sx={{ width: '60%', height: '60%' }}>
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        />
      </SvgIcon>
    </Avatar>
  );
};

// Helper functions
const getDomainFromUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return url;
  }
};

const getCompetitorInitials = (label: string): string => {
  return label
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export default StoreLogo; 