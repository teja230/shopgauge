import React, { useState } from 'react';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  Tooltip,
  Divider,
  Chip,
  useTheme,
  useMediaQuery,
  IconButton,
  Menu,
} from '@mui/material';
import {
  ShowChart,
  Timeline,
  BarChart as BarChartIcon,
  CandlestickChart,
  WaterfallChart,
  StackedLineChart,
  Analytics,
  ExpandMore,
} from '@mui/icons-material';

type ChartType = 'line' | 'area' | 'bar' | 'candlestick' | 'waterfall' | 'stacked' | 'composed';

const chartConfig = {
  line: { icon: <ShowChart fontSize="small" />, label: 'Line' },
  area: { icon: <Timeline fontSize="small" />, label: 'Area' },
  bar: { icon: <BarChartIcon fontSize="small" />, label: 'Bar' },
  candlestick: { icon: <CandlestickChart fontSize="small" />, label: 'Candlestick' },
  waterfall: { icon: <WaterfallChart fontSize="small" />, label: 'Waterfall' },
  stacked: { icon: <StackedLineChart fontSize="small" />, label: 'Stacked' },
  composed: { icon: <Analytics fontSize="small" />, label: 'Composed' },
};

const ChartTypeSelectorComparison: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Approach 1: Current (Icons + Text)
  const CurrentApproach = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Current: Icons + Text</Typography>
      <ToggleButtonGroup
        value={chartType}
        exclusive
        onChange={(_, value) => value && setChartType(value)}
        size="small"
        sx={{
          backgroundColor: theme.palette.background.default,
          borderRadius: theme.shape.borderRadius,
          border: `1px solid ${theme.palette.divider}`,
          overflowX: 'auto',
          '& .MuiToggleButton-root': {
            px: 1.5,
            py: 0.5,
            fontSize: '0.75rem',
            border: 'none',
            '&.Mui-selected': {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            },
          },
        }}
      >
        {Object.entries(chartConfig).map(([type, config]) => (
          <ToggleButton key={type} value={type}>
            {React.cloneElement(config.icon, { sx: { mr: 0.5 } })}
            {config.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );

  // Approach 2: User's Suggestion (Text only for active)
  const ActiveTextApproach = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Your Idea: Text Only for Active</Typography>
      <ToggleButtonGroup
        value={chartType}
        exclusive
        onChange={(_, value) => value && setChartType(value)}
        size="small"
        sx={{
          backgroundColor: theme.palette.background.default,
          borderRadius: theme.shape.borderRadius,
          border: `1px solid ${theme.palette.divider}`,
          '& .MuiToggleButton-root': {
            px: 1,
            py: 0.5,
            minWidth: 'auto',
            border: 'none',
            '&.Mui-selected': {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              px: 1.5,
            },
          },
        }}
      >
        {Object.entries(chartConfig).map(([type, config]) => (
          <ToggleButton key={type} value={type}>
            {React.cloneElement(config.icon, { sx: { mr: type === chartType ? 0.5 : 0 } })}
            {type === chartType && config.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );

  // Approach 3: Tooltip on Hover (Recommended)
  const TooltipApproach = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Recommended: Icons + Tooltips</Typography>
      <ToggleButtonGroup
        value={chartType}
        exclusive
        onChange={(_, value) => value && setChartType(value)}
        size="small"
        sx={{
          backgroundColor: theme.palette.background.default,
          borderRadius: theme.shape.borderRadius,
          border: `1px solid ${theme.palette.divider}`,
          '& .MuiToggleButton-root': {
            px: 1,
            py: 0.5,
            minWidth: 'auto',
            border: 'none',
            '&.Mui-selected': {
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
            },
          },
        }}
      >
        {Object.entries(chartConfig).map(([type, config]) => (
          <Tooltip key={type} title={`${config.label} Chart`} arrow>
            <ToggleButton value={type}>
              {config.icon}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
    </Box>
  );

  // Approach 4: Two-Tier (Basic + Advanced)
  const TwoTierApproach = () => {
    const basicTypes = ['line', 'area', 'bar'] as ChartType[];
    const advancedTypes = ['candlestick', 'waterfall', 'stacked', 'composed'] as ChartType[];
    
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>Two-Tier: Basic + Advanced</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ToggleButtonGroup
            value={basicTypes.includes(chartType) ? chartType : null}
            exclusive
            onChange={(_, value) => value && setChartType(value)}
            size="small"
            sx={{
              backgroundColor: theme.palette.background.default,
              borderRadius: theme.shape.borderRadius,
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                fontSize: '0.75rem',
                border: 'none',
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.primary.contrastText,
                },
              },
            }}
          >
            {basicTypes.map((type) => (
              <ToggleButton key={type} value={type}>
                {React.cloneElement(chartConfig[type].icon, { sx: { mr: 0.5 } })}
                {chartConfig[type].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          
          <ToggleButtonGroup
            value={advancedTypes.includes(chartType) ? chartType : null}
            exclusive
            onChange={(_, value) => value && setChartType(value)}
            size="small"
            sx={{
              backgroundColor: theme.palette.background.default,
              borderRadius: theme.shape.borderRadius,
              border: `1px solid ${theme.palette.divider}`,
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                fontSize: '0.75rem',
                border: 'none',
                '&.Mui-selected': {
                  backgroundColor: theme.palette.secondary.main,
                  color: theme.palette.secondary.contrastText,
                },
              },
            }}
          >
            {advancedTypes.map((type) => (
              <ToggleButton key={type} value={type}>
                {React.cloneElement(chartConfig[type].icon, { sx: { mr: 0.5 } })}
                {chartConfig[type].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    );
  };

  // Approach 5: Dropdown Style
  const DropdownApproach = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Dropdown: Single Selector</Typography>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <Select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          sx={{ 
            backgroundColor: theme.palette.background.default,
            '& .MuiSelect-select': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }
          }}
        >
          {Object.entries(chartConfig).map(([type, config]) => (
            <MenuItem key={type} value={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {config.icon}
              {config.label} Chart
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  // Approach 6: Chip Style
  const ChipApproach = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>Chips: Tag-like Selection</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {Object.entries(chartConfig).map(([type, config]) => (
          <Chip
            key={type}
            icon={config.icon}
            label={config.label}
            onClick={() => setChartType(type as ChartType)}
            color={type === chartType ? 'primary' : 'default'}
            variant={type === chartType ? 'filled' : 'outlined'}
            size="small"
            sx={{ 
              '& .MuiChip-icon': { 
                fontSize: '16px',
                ml: '8px !important'
              }
            }}
          />
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <Typography variant="h5" gutterBottom>
        Chart Type Selector: UX Comparison
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Current selection: <strong>{chartConfig[chartType].label} Chart</strong>
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <CurrentApproach />
        <Divider />
        <ActiveTextApproach />
        <Divider />
        <TooltipApproach />
        <Divider />
        <TwoTierApproach />
        <Divider />
        <DropdownApproach />
        <Divider />
        <ChipApproach />
      </Box>

      <Box sx={{ mt: 4, p: 2, backgroundColor: theme.palette.background.default, borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>Analysis:</Typography>
        <Typography variant="body2" color="text.secondary">
          • <strong>Current</strong>: Clear but cluttered with 7 options<br/>
          • <strong>Your idea</strong>: Clean but poor discoverability<br/>
          • <strong>Tooltips</strong>: Best balance of clean + discoverable<br/>
          • <strong>Two-tier</strong>: Good for grouping basic vs advanced<br/>
          • <strong>Dropdown</strong>: Most compact but requires click to see options<br/>
          • <strong>Chips</strong>: Modern look, good for mobile
        </Typography>
      </Box>
    </Box>
  );
};

export default ChartTypeSelectorComparison; 