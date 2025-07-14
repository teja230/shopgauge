import React from 'react';
import { Box, IconButton, Tooltip, Typography, CircularProgress, Badge } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface RefreshHeaderProps {
  lastUpdated: string;
  onRefresh: () => void;
  loading: boolean;
  cooldown: boolean;
  cooldownRemaining: number;
  label?: string;
  tooltip?: string;
}

const RefreshHeader: React.FC<RefreshHeaderProps> = ({
  lastUpdated,
  onRefresh,
  loading,
  cooldown,
  cooldownRemaining,
  label = 'Refresh',
  tooltip = 'Refresh data',
}) => {
  const disabled = loading || cooldown;
  const showCountdown = cooldown && cooldownRemaining > 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
      <Typography variant="body2" color="text.secondary">
        Last updated: {lastUpdated}
      </Typography>
      <Tooltip
        title={
          loading
            ? 'Refreshing...'
            : showCountdown
            ? `Please wait ${cooldownRemaining}s before refreshing again`
            : tooltip
        }
      >
        <span>
          <IconButton
            onClick={onRefresh}
            disabled={disabled}
            size="small"
            sx={{ ml: 1, position: 'relative' }}
            aria-label={label}
          >
            {loading ? (
              <CircularProgress size={20} />
            ) : showCountdown ? (
              <Badge
                badgeContent={`${cooldownRemaining}s`}
                color="secondary"
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <RefreshIcon />
              </Badge>
            ) : (
              <RefreshIcon />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

export default RefreshHeader; 