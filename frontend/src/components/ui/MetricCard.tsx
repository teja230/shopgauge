import React from 'react';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Refresh, Error } from '@mui/icons-material';

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: 'up' | 'down' | 'neutral';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoad?: () => void;
}

const deltaColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  neutral: 'text-gray-500',
};

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  delta, 
  deltaType = 'neutral',
  loading = false,
  error = null,
  onRetry,
  onLoad
}) => {
  const [hasLoaded, setHasLoaded] = React.useState(false);

  // Trigger load when component mounts if onLoad is provided and hasn't loaded yet
  React.useEffect(() => {
    if (onLoad && !hasLoaded && !loading && !error) {
      console.log(`MetricCard: Triggering load for ${label}`);
      setHasLoaded(true);
      onLoad();
    }
  }, [onLoad, hasLoaded, loading, error, label]);

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col items-start w-full min-w-[150px] max-w-xs relative">
      <div className="flex items-center justify-between w-full mb-1">
        <span className="text-sm text-gray-500">{label}</span>
        {error && onRetry && (
          <Tooltip title="Retry">
            <IconButton 
              size="small" 
              onClick={onRetry}
              className="text-red-500 hover:text-red-700"
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center w-full py-4">
          <CircularProgress size={24} />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-500 py-2">
          <Error fontSize="small" />
          <span className="text-sm">{error || 'Error loading data'}</span>
        </div>
      ) : (
        <>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {delta && (
            <span className={`text-xs mt-1 font-medium ${deltaColors[deltaType]}`}>{delta}</span>
          )}
        </>
      )}
    </div>
  );
}; 