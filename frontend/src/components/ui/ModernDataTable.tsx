import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Typography,
  Skeleton,
  Stack,
  useTheme,
  useMediaQuery,
  TablePagination,
  Collapse,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Checkbox,
  ListItemText,
  MenuItem,
} from '@mui/material';
import { DataTableSkeleton } from './SkeletonLoaders';
import SectionErrorBoundary from './SectionErrorBoundary';
import RetryHandler from './RetryHandler';
import { useKeyboardNavigation, useFocusAnnouncement } from '../../hooks/useKeyboardNavigation';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// Types
export interface TableColumn<T> {
  id: keyof T | string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'multiselect' | 'date' | 'number';
  filterOptions?: Array<{ value: string; label: string }>;
  render?: (value: any, row: T) => React.ReactNode;
  format?: (value: any) => string;
}

export interface PaginationConfig {
  page: number;
  rowsPerPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  rowsPerPageOptions?: number[];
}

export interface FilterState {
  [key: string]: any;
}

export interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

export interface ModernDataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  pagination?: PaginationConfig;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  maxHeight?: number | string;
  dense?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortState?: SortState;
  onFilter?: (filters: FilterState) => void;
  filterState?: FilterState;
  debounceMs?: number;
}

// Styled Components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  overflow: 'hidden',
}));

const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.grey[50],
  '& .MuiTableCell-head': {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    borderBottom: `2px solid ${theme.palette.divider}`,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: theme.spacing(2),
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: theme.palette.grey[50],
    '&.sortable': {
      cursor: 'pointer',
      userSelect: 'none',
      '&:hover': {
        backgroundColor: theme.palette.grey[100],
      },
    },
  },
}));

const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'hoverable' && prop !== 'striped' && prop !== 'clickable',
})<{ hoverable?: boolean; striped?: boolean; clickable?: boolean }>(({ theme, hoverable, striped, clickable }) => ({
  ...(striped && {
    '&:nth-of-type(even)': {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  ...(hoverable && {
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  }),
  ...(clickable && {
    cursor: 'pointer',
  }),
  '&:last-child .MuiTableCell-root': {
    borderBottom: 0,
  },
}));

const StyledTableCell = styled(TableCell, {
  shouldForwardProp: (prop) => prop !== 'dense',
})<{ dense?: boolean }>(({ theme, dense }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  padding: dense ? theme.spacing(1) : theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const SearchContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const FilterContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.grey[50],
}));

const ActiveFiltersContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

// Skeleton Loading Component
const TableSkeleton: React.FC<{ columns: number; rows?: number; dense?: boolean }> = ({ 
  columns, 
  rows = 5, 
  dense = false 
}) => {
  const theme = useTheme();
  
  return (
    <StyledTableContainer>
      <Table>
        <StyledTableHead>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableCell key={index}>
                <Skeleton variant="text" width="80%" height={20} />
              </TableCell>
            ))}
          </TableRow>
        </StyledTableHead>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <StyledTableCell key={colIndex} dense={dense}>
                  <Skeleton 
                    variant="text" 
                    width={colIndex === 0 ? "60%" : "40%"} 
                    height={dense ? 16 : 20} 
                  />
                </StyledTableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
};

// Empty State Component
const EmptyState: React.FC<{ message: string; onRetry?: () => void; error?: boolean }> = ({ 
  message, 
  onRetry, 
  error = false 
}) => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      {error ? 'Error Loading Data' : 'No Data Available'}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {message}
    </Typography>
    {onRetry && (
      <Button variant="outlined" onClick={onRetry}>
        Retry
      </Button>
    )}
  </Box>
);

// Search Component with Debouncing
const SearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}> = ({ value, onChange, placeholder = "Search...", debounceMs = 300 }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <TextField
      fullWidth
      size="small"
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        endAdornment: localValue && (
          <InputAdornment position="end">
            <IconButton size="small" onClick={handleClear}>
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
        },
      }}
    />
  );
};

// Filter Component
const FilterControls: React.FC<{
  columns: TableColumn<any>[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}> = ({ columns, filters, onFiltersChange }) => {
  const [expanded, setExpanded] = useState(false);
  const filterableColumns = columns.filter(col => col.filterable);

  const handleFilterChange = (columnId: string, value: any) => {
    const newFilters = { ...filters };
    if (value === '' || value === null || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[columnId];
    } else {
      newFilters[columnId] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).length;

  if (filterableColumns.length === 0) return null;

  return (
    <FilterContainer>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          startIcon={<FilterIcon />}
          endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setExpanded(!expanded)}
          variant="text"
          size="small"
        >
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </Button>
        
        {activeFilterCount > 0 && (
          <Button size="small" onClick={clearAllFilters}>
            Clear All
          </Button>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {filterableColumns.map((column) => {
              const columnId = String(column.id);
              const filterValue = filters[columnId] || '';

              if (column.filterType === 'select' && column.filterOptions) {
                return (
                  <FormControl key={columnId} size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>{column.label}</InputLabel>
                    <Select
                      value={filterValue}
                      onChange={(e) => handleFilterChange(columnId, e.target.value)}
                      input={<OutlinedInput label={column.label} />}
                    >
                      <MenuItem value="">All</MenuItem>
                      {column.filterOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }

              if (column.filterType === 'multiselect' && column.filterOptions) {
                const selectedValues = Array.isArray(filterValue) ? filterValue : [];
                return (
                  <FormControl key={columnId} size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>{column.label}</InputLabel>
                    <Select
                      multiple
                      value={selectedValues}
                      onChange={(e) => handleFilterChange(columnId, e.target.value)}
                      input={<OutlinedInput label={column.label} />}
                      renderValue={(selected) => 
                        `${(selected as string[]).length} selected`
                      }
                    >
                      {column.filterOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Checkbox checked={selectedValues.includes(option.value)} />
                          <ListItemText primary={option.label} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                );
              }

              return (
                <TextField
                  key={columnId}
                  size="small"
                  label={column.label}
                  value={filterValue}
                  onChange={(e) => handleFilterChange(columnId, e.target.value)}
                  sx={{ minWidth: 150 }}
                />
              );
            })}
          </Stack>

          {activeFilterCount > 0 && (
            <ActiveFiltersContainer>
              {Object.entries(filters).map(([columnId, value]) => {
                const column = columns.find(col => String(col.id) === columnId);
                if (!column) return null;

                let displayValue = String(value);
                if (Array.isArray(value)) {
                  displayValue = `${value.length} selected`;
                } else if (column.filterOptions) {
                  const option = column.filterOptions.find(opt => opt.value === value);
                  displayValue = option?.label || displayValue;
                }

                return (
                  <Chip
                    key={columnId}
                    label={`${column.label}: ${displayValue}`}
                    onDelete={() => handleFilterChange(columnId, '')}
                    size="small"
                    variant="outlined"
                  />
                );
              })}
            </ActiveFiltersContainer>
          )}
        </Box>
      </Collapse>
    </FilterContainer>
  );
};

// Sort Header Component
const SortableHeader: React.FC<{
  column: TableColumn<any>;
  sortState?: SortState;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
}> = ({ column, sortState, onSort }) => {
  const columnId = String(column.id);
  const isActive = sortState?.column === columnId;
  const direction = isActive ? sortState.direction : 'asc';

  const handleSort = () => {
    if (!onSort) return;
    
    if (isActive) {
      // Toggle direction if already sorted by this column
      onSort(columnId, direction === 'asc' ? 'desc' : 'asc');
    } else {
      // Start with ascending if not currently sorted
      onSort(columnId, 'asc');
    }
  };

  if (!column.sortable) {
    return <>{column.label}</>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={handleSort}
    >
      {column.label}
      {isActive ? (
        direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
      ) : (
        <SortIcon fontSize="small" sx={{ opacity: 0.5 }} />
      )}
    </Box>
  );
};

// Mobile Table Card Component
const MobileTableCard: React.FC<{
  row: any;
  columns: TableColumn<any>[];
  onRowClick?: (row: any) => void;
}> = ({ row, columns, onRowClick }) => {
  const handleClick = () => {
    if (onRowClick) {
      onRowClick(row);
    }
  };

  // Get the first column as the primary identifier
  const primaryColumn = columns[0];
  const primaryValue = primaryColumn.render 
    ? primaryColumn.render(row[primaryColumn.id as keyof typeof row], row)
    : primaryColumn.format 
    ? primaryColumn.format(row[primaryColumn.id as keyof typeof row])
    : row[primaryColumn.id as keyof typeof row];

  return (
    <Card 
      className={`admin-mobile-table-card ${onRowClick ? 'admin-interactive' : ''}`}
      onClick={onRowClick ? handleClick : undefined}
      sx={{ 
        cursor: onRowClick ? 'pointer' : 'default',
        '&:hover': onRowClick ? {
          boxShadow: 'var(--admin-card-shadow-hover)',
          transform: 'translateY(-1px)',
        } : {},
      }}
    >
      <CardContent sx={{ padding: 'var(--admin-space-4)', '&:last-child': { paddingBottom: 'var(--admin-space-4)' } }}>
        <div className="admin-mobile-table-card__header">
          <Typography 
            variant="subtitle1" 
            className="admin-mobile-table-card__title"
            sx={{ 
              fontWeight: 'var(--admin-font-weight-semibold)',
              color: 'var(--admin-text-primary)',
              fontSize: 'var(--admin-font-size-base)',
            }}
          >
            {primaryValue}
          </Typography>
        </div>
        
        <div className="admin-mobile-table-card__body">
          {columns.slice(1).map((column) => {
            const value = row[column.id as keyof typeof row];
            const displayValue = column.render 
              ? column.render(value, row)
              : column.format 
              ? column.format(value)
              : value;

            return (
              <div key={String(column.id)} className="admin-mobile-table-card__row">
                <Typography 
                  variant="body2" 
                  className="admin-mobile-table-card__label"
                  sx={{ 
                    fontWeight: 'var(--admin-font-weight-medium)',
                    color: 'var(--admin-text-secondary)',
                    fontSize: 'var(--admin-font-size-sm)',
                  }}
                >
                  {column.label}
                </Typography>
                <Typography 
                  variant="body2" 
                  className="admin-mobile-table-card__value"
                  sx={{ 
                    color: 'var(--admin-text-primary)',
                    fontSize: 'var(--admin-font-size-sm)',
                    textAlign: 'right',
                  }}
                >
                  {displayValue}
                </Typography>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
export const ModernDataTable = <T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  searchable = true,
  filterable = true,
  pagination,
  onRowClick,
  stickyHeader = true,
  searchPlaceholder = "Search...",
  emptyMessage = "No data available",
  error = null,
  onRetry,
  maxHeight = 600,
  dense = false,
  striped = false,
  hoverable = true,
  onSort,
  sortState,
  onFilter,
  filterState = {},
  debounceMs = 300,
}: ModernDataTableProps<T>) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  
  const [searchTerm, setSearchTerm] = useState('');
  const [localFilters, setLocalFilters] = useState<FilterState>(filterState);
  const { announce } = useFocusAnnouncement();

  // Keyboard navigation for table rows
  const { containerRef } = useKeyboardNavigation({
    enableArrowNavigation: !isMobile && !!onRowClick,
    onEscape: () => {
      // Clear search or filters on escape
      if (searchTerm) {
        setSearchTerm('');
        announce('Search cleared', 'polite');
      }
    },
  });

  // Update local filters when external filter state changes
  useEffect(() => {
    setLocalFilters(filterState);
  }, [filterState]);

  // Handle filter changes
  const handleFiltersChange = useCallback((filters: FilterState) => {
    setLocalFilters(filters);
    if (onFilter) {
      onFilter(filters);
    }
  }, [onFilter]);

  // Filter and search data locally if no external handlers provided
  const filteredData = useMemo(() => {
    if (onFilter && onSort) {
      // External filtering and sorting
      return data;
    }

    let filtered = [...data];

    // Apply search
    if (searchTerm && searchable) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        columns.some(column => {
          const value = row[column.id as keyof T];
          return String(value || '').toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply filters
    Object.entries(localFilters).forEach(([columnId, filterValue]) => {
      if (filterValue !== '' && filterValue != null) {
        filtered = filtered.filter(row => {
          const cellValue = row[columnId as keyof T];
          
          if (Array.isArray(filterValue)) {
            return filterValue.includes(String(cellValue));
          }
          
          return String(cellValue || '').toLowerCase().includes(String(filterValue).toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortState?.column && !onSort) {
      const { column: sortColumn, direction } = sortState;
      filtered.sort((a, b) => {
        const aValue = a[sortColumn as keyof T];
        const bValue = b[sortColumn as keyof T];
        
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, localFilters, sortState, columns, searchable, onFilter, onSort]);

  // Loading state
  if (loading) {
    return (
      <DataTableSkeleton 
        columns={columns.length} 
        rows={5} 
        hasSearch={searchable}
        hasFilters={filterable}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <SectionErrorBoundary sectionName="Data Table" level="component">
        <RetryHandler
          operation={async () => {
            if (onRetry) {
              onRetry();
            }
          }}
          config={{
            maxAttempts: 3,
            baseDelay: 1000,
          }}
          trigger={!!error}
          showUI={true}
          compact={true}
          title="Failed to Load Data"
          description={error}
        />
      </SectionErrorBoundary>
    );
  }

  // Empty state
  if (filteredData.length === 0 && !loading) {
    return (
      <StyledTableContainer>
        {(searchable || filterable) && (
          <>
            {searchable && (
              <SearchContainer>
                <SearchField
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={searchPlaceholder}
                  debounceMs={debounceMs}
                />
              </SearchContainer>
            )}
            
            {filterable && (
              <FilterControls
                columns={columns}
                filters={localFilters}
                onFiltersChange={handleFiltersChange}
              />
            )}
          </>
        )}
        <EmptyState message={emptyMessage} />
      </StyledTableContainer>
    );
  }

  return (
    <SectionErrorBoundary sectionName="Data Table" level="section">
      <Box ref={containerRef}>
        <StyledTableContainer 
          sx={{ maxHeight }}
          role="region"
          aria-label="Data table"
        >
        {/* Search Bar */}
        {searchable && (
          <SearchContainer role="search" aria-label="Search data">
            <SearchField
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                announce(value ? `Searching for ${value}` : 'Search cleared', 'polite');
              }}
              placeholder={searchPlaceholder}
              debounceMs={debounceMs}
            />
          </SearchContainer>
        )}

        {/* Filter Controls */}
        {filterable && (
          <FilterControls
            columns={columns}
            filters={localFilters}
            onFiltersChange={(filters) => {
              handleFiltersChange(filters);
              const activeCount = Object.keys(filters).length;
              announce(
                activeCount > 0 
                  ? `${activeCount} filter${activeCount === 1 ? '' : 's'} applied`
                  : 'All filters cleared',
                'polite'
              );
            }}
          />
        )}

        {/* Mobile Card View */}
        {isMobile ? (
          <Box 
            sx={{ padding: 2 }}
            role="list"
            aria-label={`Data cards, ${filteredData.length} items`}
          >
            <Stack spacing={2}>
              {filteredData.map((row, index) => (
                <div key={index} role="listitem">
                  <MobileTableCard
                    row={row}
                    columns={columns}
                    onRowClick={onRowClick}
                  />
                </div>
              ))}
            </Stack>
          </Box>
        ) : (
          /* Desktop/Tablet Table View */
          <Table 
            stickyHeader={stickyHeader}
            role="table"
            aria-label={`Data table with ${filteredData.length} rows and ${columns.length} columns`}
            aria-rowcount={filteredData.length + 1} // +1 for header
            aria-colcount={columns.length}
          >
            <StyledTableHead>
              <TableRow role="row" aria-rowindex={1}>
                {columns.map((column, colIndex) => (
                  <TableCell
                    key={String(column.id)}
                    align={column.align || 'left'}
                    style={{ minWidth: column.minWidth }}
                    className={column.sortable ? 'sortable' : ''}
                    role="columnheader"
                    aria-colindex={colIndex + 1}
                    aria-sort={
                      sortState?.column === String(column.id)
                        ? sortState.direction === 'asc' ? 'ascending' : 'descending'
                        : column.sortable ? 'none' : undefined
                    }
                  >
                    <SortableHeader
                      column={column}
                      sortState={sortState}
                      onSort={(col, dir) => {
                        if (onSort) {
                          onSort(col, dir);
                          announce(`Table sorted by ${column.label} ${dir}ending`, 'polite');
                        }
                      }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </StyledTableHead>
            
            <TableBody role="rowgroup">
              {filteredData.map((row, rowIndex) => (
                <StyledTableRow
                  key={rowIndex}
                  hoverable={hoverable}
                  striped={striped}
                  clickable={!!onRowClick}
                  onClick={() => {
                    if (onRowClick) {
                      onRowClick(row);
                      announce(`Row ${rowIndex + 1} selected`, 'polite');
                    }
                  }}
                  role="row"
                  aria-rowindex={rowIndex + 2} // +2 because header is row 1
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row);
                      announce(`Row ${rowIndex + 1} selected`, 'polite');
                    }
                  } : undefined}
                  aria-label={onRowClick ? `Row ${rowIndex + 1}, click to select` : undefined}
                >
                  {columns.map((column, colIndex) => {
                    const value = row[column.id as keyof T];
                    const displayValue = column.render 
                      ? column.render(value, row)
                      : column.format 
                      ? column.format(value)
                      : value;

                    return (
                      <StyledTableCell
                        key={String(column.id)}
                        align={column.align || 'left'}
                        dense={dense}
                        role="cell"
                        aria-colindex={colIndex + 1}
                        aria-describedby={`column-${String(column.id)}-header`}
                      >
                        {displayValue}
                      </StyledTableCell>
                    );
                  })}
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </StyledTableContainer>

      {/* Pagination */}
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.totalCount}
          page={pagination.page}
          onPageChange={(_, newPage) => {
            pagination.onPageChange(newPage);
            announce(`Page ${newPage + 1} of ${Math.ceil(pagination.totalCount / pagination.rowsPerPage)}`, 'polite');
          }}
          rowsPerPage={pagination.rowsPerPage}
          onRowsPerPageChange={(e) => {
            const newRowsPerPage = parseInt(e.target.value, 10);
            pagination.onRowsPerPageChange(newRowsPerPage);
            announce(`Showing ${newRowsPerPage} rows per page`, 'polite');
          }}
          rowsPerPageOptions={pagination.rowsPerPageOptions || [10, 25, 50, 100]}
          sx={{
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
          aria-label="Table pagination controls"
        />
      )}
    </Box>
    </SectionErrorBoundary>
  );
};

export default ModernDataTable;