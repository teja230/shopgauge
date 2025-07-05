import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  source: string;
}

interface DebugPanelProps {
  isVisible?: boolean;
  onToggleVisibility?: (visible: boolean) => void;
}

// Environment variable controls
const DEBUG_PANEL_ENABLED = import.meta.env.VITE_DEBUG_PANEL_ENABLED === 'true';
const DEBUG_PANEL_STORE = (import.meta.env.VITE_DEBUG_PANEL_STORE as string) || '';

// Global debug state
let debugLogs: LogEntry[] = [];
let debugSubscribers: ((logs: LogEntry[]) => void)[] = [];
let isDebugEnabled = DEBUG_PANEL_ENABLED;
let currentStore: string | null = null;

// Helper functions
const setCurrentStore = (store: string | null) => {
  currentStore = store;
};

const shouldDebugForStore = (): boolean => {
  return DEBUG_PANEL_ENABLED; // Simplified for now - can enhance with store filtering later
};

// Debug logging functions
const createLogEntry = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any, source: string = 'App') => {
  if (shouldDebugForStore()) {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      timestamp: new Date(),
      level,
      message,
      data,
      source,
    };
    debugLogs.push(entry);
    if (debugLogs.length > 1000) { // Keep only last 1000 logs
      debugLogs = debugLogs.slice(-1000);
    }
    debugSubscribers.forEach(callback => callback([...debugLogs]));
  }
};

export const debugLog = {
  info: (message: string, data?: any, source: string = 'App') => {
    createLogEntry('info', message, data, source);
  },
  warn: (message: string, data?: any, source: string = 'App') => {
    createLogEntry('warn', message, data, source);
  },
  error: (message: string, data?: any, source: string = 'App') => {
    createLogEntry('error', message, data, source);
  },
  debug: (message: string, data?: any, source: string = 'App') => {
    createLogEntry('debug', message, data, source);
  },
  clear: () => {
    debugLogs = [];
    debugSubscribers.forEach(callback => callback([...debugLogs]));
  },
  enable: () => {
    isDebugEnabled = true;
  },
  disable: () => {
    isDebugEnabled = false;
  },
  getLogs: () => [...debugLogs],
  setStore: setCurrentStore,
  isEnabled: () => shouldDebugForStore(),
};

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  isVisible = false, 
  onToggleVisibility 
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  // Subscribe to debug logs
  useEffect(() => {
    const handleLogsUpdate = (newLogs: LogEntry[]) => {
      setLogs(newLogs);
    };

    debugSubscribers.push(handleLogsUpdate);
    setLogs(debugLogs);

    return () => {
      debugSubscribers = debugSubscribers.filter(sub => sub !== handleLogsUpdate);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logs]);

  // Enable debug logging when panel is visible
  useEffect(() => {
    if (isVisible) {
      debugLog.enable();
    }
  }, [isVisible]);

  // Don't render anything if debug panel is not enabled via environment variable
  if (!DEBUG_PANEL_ENABLED) {
    return null;
  }

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#d32f2f';
      case 'warn': return '#ed6c02';
      case 'debug': return '#0288d1';
      default: return '#2e7d32';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getLevels = () => {
    const levels = new Set(logs.map(log => log.level));
    return Array.from(levels).sort();
  };

  if (!isVisible) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 9998,
        }}
      >
        <Button
          variant="contained"
          onClick={() => onToggleVisibility?.(true)}
          sx={{
            backgroundColor: '#1976d2',
            color: 'white',
            minWidth: 'auto',
            width: 48,
            height: 48,
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            '&:hover': {
              backgroundColor: '#1565c0',
            },
          }}
        >
          🐛
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: '400px',
        maxHeight: '600px',
        zIndex: 9999,
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          padding: '12px 16px',
          backgroundColor: '#1976d2',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <span style={{ fontSize: '20px' }}>🐛</span>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Debug Panel
          </Typography>
          <Chip 
            label={logs.length} 
            size="small" 
            sx={{ 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              color: 'white',
              fontSize: '10px',
              height: '20px'
            }} 
          />
        </Box>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Button
            size="small"
            onClick={() => setIsExpanded(!isExpanded)}
            sx={{ 
              color: 'white', 
              minWidth: 'auto',
              width: 28, 
              height: 28,
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {isExpanded ? '−' : '+'}
          </Button>
          <Button
            size="small"
            onClick={() => onToggleVisibility?.(false)}
            sx={{ 
              color: 'white', 
              minWidth: 'auto',
              width: 28, 
              height: 28,
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            ✕
          </Button>
        </Box>
      </Box>

      {/* Controls */}
      {isExpanded && (
        <Box sx={{ padding: '16px', borderBottom: '1px solid #e0e0e0' }}>
          <Box display="flex" gap={1} mb={1}>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flexGrow: 1,
                padding: '8px 12px',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={debugLog.clear}
              sx={{ textTransform: 'none' }}
            >
              Clear
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setLogs([...debugLogs])}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
          </Box>

          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label="All Levels"
              size="small"
              variant={filterLevel === 'all' ? 'filled' : 'outlined'}
              onClick={() => setFilterLevel('all')}
              color={filterLevel === 'all' ? 'primary' : 'default'}
            />
            {getLevels().map(level => (
              <Chip
                key={level}
                label={level}
                size="small"
                variant={filterLevel === level ? 'filled' : 'outlined'}
                onClick={() => setFilterLevel(level)}
                sx={{ 
                  color: filterLevel === level ? 'white' : getLevelColor(level),
                  backgroundColor: filterLevel === level ? getLevelColor(level) : 'transparent',
                  borderColor: getLevelColor(level),
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Content */}
      <Box
        ref={contentRef}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          maxHeight: '400px',
          padding: '8px',
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            background: '#f1f1f1',
            borderRadius: 3,
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#c1c1c1',
            borderRadius: 3,
          },
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box p={2} textAlign="center" color="text.secondary">
            <Typography variant="body2">No logs to display</Typography>
            <Typography variant="caption">
              {searchTerm || filterLevel !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Debug logs will appear here when enabled'
              }
            </Typography>
          </Box>
        ) : (
          filteredLogs.map((log) => (
            <Box
              key={log.id}
              sx={{
                padding: '8px',
                margin: '4px 0',
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                backgroundColor: log.level === 'error' ? '#ffebee' :
                                log.level === 'warn' ? '#fff3e0' :
                                log.level === 'debug' ? '#e3f2fd' :
                                '#f1f8e9',
                fontSize: '12px',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: getLevelColor(log.level),
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {log.level}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(log.timestamp)}
                  </Typography>
                  <Chip
                    label={log.source}
                    size="small"
                    variant="outlined"
                    sx={{ height: '16px', fontSize: '10px' }}
                  />
                </Box>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '11px' }}>
                {log.message}
              </Typography>
              {log.data && (
                <Box mt={1}>
                  <pre
                    style={{
                      backgroundColor: '#f5f5f5',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      overflow: 'auto',
                      maxHeight: '100px',
                      fontFamily: 'monospace',
                      margin: 0,
                    }}
                  >
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default DebugPanel; 