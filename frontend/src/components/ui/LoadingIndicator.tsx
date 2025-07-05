import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export interface LoadingIndicatorProps {
  /** Height of container (px). If undefined, auto. */
  height?: number | string;
  /** Optional loading message */
  message?: string;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Centralised loading spinner used across charts and dashboard cards.
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  height = 200,
  message = 'Loading…',
  ariaLabel = 'loading-indicator',
}) => (
  <Box
    sx={{
      height,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1.5,
    }}
    aria-label={ariaLabel}
  >
    <CircularProgress size={32} />
    {message && (
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    )}
  </Box>
);

export default LoadingIndicator;