# ModernDataTable Component

A comprehensive, enterprise-grade data table component built for the ShopGauge admin interface. This component provides advanced features including real-time search, filtering, sorting, pagination, and responsive design.

## Features

### Core Features
- ✅ **Sticky Headers** - Headers remain visible while scrolling through large datasets
- ✅ **Real-time Search** - Debounced search with customizable delay (default 300ms)
- ✅ **Advanced Filtering** - Multiple filter types with active filter indicators
- ✅ **Sorting** - Click-to-sort with visual indicators for direction
- ✅ **Pagination** - Built-in pagination with customizable page sizes
- ✅ **Skeleton Loading** - Contextual loading states instead of spinners
- ✅ **Responsive Design** - Optimized for desktop, tablet, and mobile
- ✅ **Accessibility** - Full keyboard navigation and screen reader support

### Filter Types
- **Text Filter** - Free-form text search within column values
- **Select Filter** - Single-select dropdown with predefined options
- **Multi-select Filter** - Multiple selection with checkbox interface
- **Date Filter** - Date range selection (planned)
- **Number Filter** - Numeric range filtering (planned)

### Loading States
- **Skeleton Rows** - Animated skeleton placeholders during data loading
- **Error States** - User-friendly error messages with retry functionality
- **Empty States** - Customizable empty state messages

## Usage

### Basic Usage

```tsx
import { ModernDataTable } from './components/ui/ModernDataTable';
import type { TableColumn } from './components/ui/ModernDataTable';

interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

const columns: TableColumn<User>[] = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,
    filterable: true,
  },
  {
    id: 'email',
    label: 'Email',
    sortable: true,
    filterable: true,
  },
  {
    id: 'status',
    label: 'Status',
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
  },
];

const MyComponent = () => {
  const [users, setUsers] = useState<User[]>([]);
  
  return (
    <ModernDataTable
      data={users}
      columns={columns}
      searchable={true}
      filterable={true}
      stickyHeader={true}
    />
  );
};
```

### Advanced Usage with Custom Rendering

```tsx
const advancedColumns: TableColumn<User>[] = [
  {
    id: 'name',
    label: 'User',
    minWidth: 200,
    sortable: true,
    filterable: true,
    render: (value, row) => (
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar>{row.name[0]}</Avatar>
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      </Stack>
    ),
  },
  {
    id: 'status',
    label: 'Status',
    sortable: true,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
    ],
    render: (value) => (
      <Chip
        label={value}
        color={value === 'active' ? 'success' : 'error'}
        size="small"
      />
    ),
  },
];
```

### With Pagination

```tsx
const [page, setPage] = useState(0);
const [rowsPerPage, setRowsPerPage] = useState(25);

const pagination = {
  page,
  rowsPerPage,
  totalCount: 1000,
  onPageChange: setPage,
  onRowsPerPageChange: setRowsPerPage,
  rowsPerPageOptions: [10, 25, 50, 100],
};

<ModernDataTable
  data={users}
  columns={columns}
  pagination={pagination}
  // ... other props
/>
```

### With External Sorting and Filtering

```tsx
const [sortState, setSortState] = useState({ column: null, direction: 'asc' });
const [filters, setFilters] = useState({});

const handleSort = (column: string, direction: 'asc' | 'desc') => {
  setSortState({ column, direction });
  // Fetch sorted data from API
  fetchUsers({ sort: { column, direction } });
};

const handleFilter = (filters: FilterState) => {
  setFilters(filters);
  // Fetch filtered data from API
  fetchUsers({ filters });
};

<ModernDataTable
  data={users}
  columns={columns}
  onSort={handleSort}
  sortState={sortState}
  onFilter={handleFilter}
  filterState={filters}
  // ... other props
/>
```

## Props API

### ModernDataTableProps<T>

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | **required** | Array of data objects to display |
| `columns` | `TableColumn<T>[]` | **required** | Column configuration array |
| `loading` | `boolean` | `false` | Show skeleton loading state |
| `searchable` | `boolean` | `true` | Enable search functionality |
| `filterable` | `boolean` | `true` | Enable filter controls |
| `pagination` | `PaginationConfig` | `undefined` | Pagination configuration |
| `onRowClick` | `(row: T) => void` | `undefined` | Row click handler |
| `stickyHeader` | `boolean` | `true` | Make headers sticky |
| `searchPlaceholder` | `string` | `"Search..."` | Search input placeholder |
| `emptyMessage` | `string` | `"No data available"` | Empty state message |
| `error` | `string \| null` | `null` | Error message to display |
| `onRetry` | `() => void` | `undefined` | Error retry handler |
| `maxHeight` | `number \| string` | `600` | Maximum table height |
| `dense` | `boolean` | `false` | Use dense row spacing |
| `striped` | `boolean` | `false` | Alternate row colors |
| `hoverable` | `boolean` | `true` | Enable row hover effects |
| `onSort` | `(column: string, direction: 'asc' \| 'desc') => void` | `undefined` | External sort handler |
| `sortState` | `SortState` | `undefined` | Current sort state |
| `onFilter` | `(filters: FilterState) => void` | `undefined` | External filter handler |
| `filterState` | `FilterState` | `{}` | Current filter state |
| `debounceMs` | `number` | `300` | Search debounce delay |

### TableColumn<T>

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `keyof T \| string` | **required** | Column identifier |
| `label` | `string` | **required** | Column header label |
| `minWidth` | `number` | `undefined` | Minimum column width |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Text alignment |
| `sortable` | `boolean` | `false` | Enable sorting |
| `filterable` | `boolean` | `false` | Enable filtering |
| `filterType` | `'text' \| 'select' \| 'multiselect' \| 'date' \| 'number'` | `'text'` | Filter input type |
| `filterOptions` | `Array<{value: string, label: string}>` | `undefined` | Options for select filters |
| `render` | `(value: any, row: T) => React.ReactNode` | `undefined` | Custom cell renderer |
| `format` | `(value: any) => string` | `undefined` | Value formatter |

### PaginationConfig

| Prop | Type | Description |
|------|------|-------------|
| `page` | `number` | Current page (0-indexed) |
| `rowsPerPage` | `number` | Rows per page |
| `totalCount` | `number` | Total number of items |
| `onPageChange` | `(page: number) => void` | Page change handler |
| `onRowsPerPageChange` | `(rowsPerPage: number) => void` | Rows per page change handler |
| `rowsPerPageOptions` | `number[]` | Available page size options |

## Styling and Theming

The component uses Material-UI's theming system and follows the design system specifications:

### CSS Custom Properties
```css
:root {
  --admin-primary: #1976d2;
  --admin-grey-50: #fafafa;
  --admin-grey-100: #f5f5f5;
  --admin-grey-200: #eeeeee;
  /* ... other design tokens */
}
```

### Responsive Breakpoints
- **Desktop (≥1024px)**: Full table with all features
- **Tablet (768px - 1023px)**: Horizontal scroll for wide tables
- **Mobile (≤767px)**: Stacked layout with mobile-optimized interactions

## Performance Considerations

### Optimization Features
- **Debounced Search**: Prevents excessive API calls during typing
- **Memoized Filtering**: Efficient local filtering with useMemo
- **Skeleton Loading**: Better perceived performance than spinners
- **Sticky Headers**: Virtualized scrolling for large datasets

### Best Practices
- Use `React.memo` for expensive cell renderers
- Implement server-side pagination for large datasets (>1000 rows)
- Use external sorting/filtering for better performance
- Consider virtualization for tables with >100 rows

## Accessibility

### ARIA Support
- Proper table semantics with `role="table"`
- Column headers with `role="columnheader"`
- Sortable columns with `aria-sort` attributes
- Screen reader announcements for filter changes

### Keyboard Navigation
- Tab navigation through interactive elements
- Enter/Space to activate sort headers
- Arrow keys for pagination controls
- Escape to clear search/filters

### Touch Support
- Minimum 44px touch targets
- Touch-friendly filter controls
- Swipe gestures for mobile tables

## Integration Examples

### Admin Audit Logs
```tsx
const auditColumns: TableColumn<AuditLog>[] = [
  {
    id: 'timestamp',
    label: 'Time',
    sortable: true,
    format: (value) => new Date(value).toLocaleString(),
  },
  {
    id: 'action',
    label: 'Action',
    sortable: true,
    filterable: true,
    render: (value) => (
      <Typography variant="body2" fontFamily="monospace">
        {value}
      </Typography>
    ),
  },
  {
    id: 'severity',
    label: 'Severity',
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
    ],
    render: (value) => (
      <Chip
        label={value}
        color={getSeverityColor(value)}
        size="small"
      />
    ),
  },
];
```

### Session Management
```tsx
const sessionColumns: TableColumn<Session>[] = [
  {
    id: 'shopDomain',
    label: 'Shop',
    sortable: true,
    filterable: true,
  },
  {
    id: 'lastActivity',
    label: 'Last Activity',
    sortable: true,
    format: (value) => formatDistanceToNow(new Date(value)),
  },
  {
    id: 'status',
    label: 'Status',
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'expired', label: 'Expired' },
    ],
  },
];
```

## Testing

The component includes comprehensive tests covering:
- Basic rendering and data display
- Search functionality with debouncing
- Filter controls and active filter indicators
- Sorting behavior and visual feedback
- Pagination controls and callbacks
- Loading and error states
- Accessibility features
- Responsive behavior

Run tests with:
```bash
npm test -- --testPathPattern=ModernDataTable.test.tsx
```

## Migration from Legacy Tables

### From MUI Table
```tsx
// Before
<Table>
  <TableHead>
    <TableRow>
      <TableCell>Name</TableCell>
      <TableCell>Email</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    {data.map(row => (
      <TableRow key={row.id}>
        <TableCell>{row.name}</TableCell>
        <TableCell>{row.email}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>

// After
<ModernDataTable
  data={data}
  columns={[
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
  ]}
/>
```

### Benefits of Migration
- **Reduced Code**: 80% less boilerplate code
- **Built-in Features**: Search, filtering, sorting out of the box
- **Better UX**: Loading states, error handling, responsive design
- **Accessibility**: Full ARIA support and keyboard navigation
- **Performance**: Optimized rendering and data handling

## Troubleshooting

### Common Issues

**Search not working**
- Ensure `searchable={true}` is set
- Check that column data is searchable (strings/numbers)
- Verify debounce timing with `debounceMs` prop

**Filters not appearing**
- Set `filterable={true}` on the table
- Add `filterable: true` to individual columns
- Provide `filterOptions` for select/multiselect filters

**Sorting not working**
- Add `sortable: true` to column definitions
- For external sorting, provide `onSort` and `sortState` props
- Ensure data types are sortable (strings, numbers, dates)

**Performance issues**
- Implement server-side pagination for large datasets
- Use external filtering/sorting instead of client-side
- Add `React.memo` to custom cell renderers
- Consider table virtualization for >1000 rows

### Debug Mode
Enable debug logging:
```tsx
<ModernDataTable
  // ... props
  onSort={(column, direction) => {
    console.log('Sort:', { column, direction });
    // ... handle sort
  }}
  onFilter={(filters) => {
    console.log('Filters:', filters);
    // ... handle filter
  }}
/>
```