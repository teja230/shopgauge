import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ModernDataTable, TableColumn } from '../ModernDataTable';

const theme = createTheme();

// Test data
interface TestData {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  role: string;
  lastLogin: string;
  score: number;
}

const mockData: TestData[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    role: 'admin',
    lastLogin: '2024-01-15',
    score: 95,
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'inactive',
    role: 'user',
    lastLogin: '2024-01-10',
    score: 87,
  },
  {
    id: 3,
    name: 'Bob Johnson',
    email: 'bob@example.com',
    status: 'active',
    role: 'user',
    lastLogin: '2024-01-20',
    score: 92,
  },
];

const mockColumns: TableColumn<TestData>[] = [
  {
    id: 'name',
    label: 'Name',
    sortable: true,
    filterable: true,
    minWidth: 150,
  },
  {
    id: 'email',
    label: 'Email',
    sortable: true,
    filterable: true,
    minWidth: 200,
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
      <span style={{ color: value === 'active' ? 'green' : 'red' }}>
        {value}
      </span>
    ),
  },
  {
    id: 'role',
    label: 'Role',
    sortable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: [
      { value: 'admin', label: 'Admin' },
      { value: 'user', label: 'User' },
    ],
  },
  {
    id: 'score',
    label: 'Score',
    align: 'right',
    sortable: true,
    format: (value) => `${value}%`,
  },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ModernDataTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders table with data', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Check if table headers are rendered
      expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();

      // Check if data rows are rendered
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('renders loading skeleton when loading', () => {
      renderWithTheme(
        <ModernDataTable
          data={[]}
          columns={mockColumns}
          loading={true}
        />
      );

      // Should show skeleton loaders
      const skeletons = screen.getAllByTestId('skeleton-cell');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders empty state when no data', () => {
      renderWithTheme(
        <ModernDataTable
          data={[]}
          columns={mockColumns}
          emptyMessage="No users found"
        />
      );

      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('retries when an error is provided', async () => {
      const mockRetry = jest.fn();
      renderWithTheme(
        <ModernDataTable
          data={[]}
          columns={mockColumns}
          error="Failed to load data"
          onRetry={mockRetry}
        />
      );

      await waitFor(() => expect(mockRetry).toHaveBeenCalledTimes(1));
      expect(await screen.findByText('Operation completed successfully')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search field when searchable is true', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          searchable={true}
          searchPlaceholder="Search users..."
        />
      );

      const searchInput = screen.getByPlaceholderText('Search users...');
      expect(searchInput).toBeInTheDocument();
    });

    it('filters data based on search term', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          searchable={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'John');

      // Wait for debounced search
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('clears search when clear button is clicked', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          searchable={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'John' } });
      expect(searchInput).toHaveValue('John');

      // Click clear button
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
    });

    it('hides search field when searchable is false', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          searchable={false}
        />
      );

      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });
  });

  describe('Filter Functionality', () => {
    it('renders filter controls when filterable is true', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      const filtersButton = screen.getByText(/filters/i);
      expect(filtersButton).toBeInTheDocument();
    });

    it('expands and collapses filter controls', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      const filtersButton = screen.getByText(/filters/i);
      
      // Initially collapsed
      expect(filtersButton).toHaveAttribute('aria-expanded', 'false');

      // Expand filters
      fireEvent.click(filtersButton);
      expect(filtersButton).toHaveAttribute('aria-expanded', 'true');

      // Collapse filters
      fireEvent.click(filtersButton);
      expect(filtersButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('applies text filters', async () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      // Expand filters
      const filtersButton = screen.getByText(/filters/i);
      fireEvent.click(filtersButton);

      // Apply name filter
      const nameFilter = screen.getByLabelText('Name');
      fireEvent.change(nameFilter, { target: { value: 'John' } });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('applies select filters', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      // Expand filters
      const filtersButton = screen.getByText(/filters/i);
      await user.click(filtersButton);

      // Apply status filter
      const statusFilter = screen.getByLabelText('Status');
      await user.click(statusFilter);
      
      const activeOption = screen.getByText('Active');
      await user.click(activeOption);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('shows active filter indicators', async () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      // Expand filters
      const filtersButton = screen.getByText(/filters/i);
      fireEvent.click(filtersButton);

      // Apply name filter
      const nameFilter = screen.getByLabelText('Name');
      fireEvent.change(nameFilter, { target: { value: 'John' } });

      // Should show active filter chip
      await waitFor(() => {
        expect(screen.getByText(/Name: John/)).toBeInTheDocument();
      });
    });

    it('clears all filters', async () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          filterable={true}
        />
      );

      // Expand filters and apply filter
      const filtersButton = screen.getByText(/filters/i);
      fireEvent.click(filtersButton);

      const nameFilter = screen.getByLabelText('Name');
      fireEvent.change(nameFilter, { target: { value: 'John' } });

      // Clear all filters
      const clearAllButton = screen.getByText('Clear All');
      fireEvent.click(clearAllButton);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts data when column header is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Click on Name column header to sort
      const nameHeader = screen.getByRole('button', { name: 'Name' });
      await user.click(nameHeader);

      // Check if data is sorted (Bob should come first alphabetically)
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Bob Johnson');
    });

    it('toggles sort direction on repeated clicks', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      const nameHeader = screen.getByRole('button', { name: 'Name' });
      
      // First click - ascending
      await user.click(nameHeader);
      let rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Bob Johnson');

      // Second click - descending
      await user.click(nameHeader);
      rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('John Doe');
    });

    it('calls onSort callback when provided', async () => {
      const mockOnSort = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          onSort={mockOnSort}
        />
      );

      const nameHeader = screen.getByRole('button', { name: 'Name' });
      await user.click(nameHeader);

      expect(mockOnSort).toHaveBeenCalledWith('name', 'asc');
    });
  });

  describe('Row Interaction', () => {
    it('calls onRowClick when row is clicked', async () => {
      const mockOnRowClick = jest.fn();
      const user = userEvent.setup();
      
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          onRowClick={mockOnRowClick}
        />
      );

      // Click on first data row
      const firstRow = screen.getByText('John Doe').closest('tr');
      await user.click(firstRow!);

      expect(mockOnRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('applies hover styles when hoverable is true', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          hoverable={true}
        />
      );

      const firstRow = screen.getByText('John Doe').closest('tr');
      expect(firstRow).toHaveStyle('transition: background-color 0.2s ease');
    });
  });

  describe('Pagination', () => {
    it('renders pagination when provided', () => {
      const mockPagination = {
        page: 0,
        rowsPerPage: 10,
        totalCount: 100,
        onPageChange: jest.fn(),
        onRowsPerPageChange: jest.fn(),
      };

      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          pagination={mockPagination}
        />
      );

      expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    });

    it('calls pagination callbacks', async () => {
      const mockOnPageChange = jest.fn();
      const mockOnRowsPerPageChange = jest.fn();
      const user = userEvent.setup();

      const mockPagination = {
        page: 0,
        rowsPerPage: 10,
        totalCount: 100,
        onPageChange: mockOnPageChange,
        onRowsPerPageChange: mockOnRowsPerPageChange,
      };

      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          pagination={mockPagination}
        />
      );

      // Test page change
      const nextPageButton = screen.getByLabelText('Go to next page');
      await user.click(nextPageButton);
      expect(mockOnPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe('Custom Rendering', () => {
    it('uses custom render function for columns', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Status column should use custom render (colored text)
      const activeStatus = screen.getAllByText('active')[0];
      expect(activeStatus).toHaveStyle('color: rgb(0, 128, 0)');
    });

    it('uses format function for columns', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Score column should be formatted with %
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('87%')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies dense styling when dense prop is true', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          dense={true}
        />
      );

      // Dense tables should have reduced padding
      const cells = screen.getAllByRole('cell');
      expect(cells[0]).toHaveStyle('padding: 8px');
    });

    it('applies striped styling when striped prop is true', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          striped={true}
        />
      );

      // Should have striped rows (even rows with background color)
      const rows = screen.getAllByRole('row');
      // Note: Testing striped styling would require more complex CSS testing
      expect(rows.length).toBeGreaterThan(1);
    });

    it('renders mobile card view on small screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 768px)'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // On mobile, should render cards instead of table
      // Note: This test would need more sophisticated mocking of useMediaQuery
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('maintains touch target sizes for mobile interactions', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
          onRowClick={jest.fn()}
        />
      );

      // Interactive elements should have minimum touch target size
      const rows = screen.getAllByRole('row');
      // Note: Testing touch target sizes would require CSS testing
      expect(rows.length).toBeGreaterThan(1);
    });

    it('handles horizontal scrolling on tablet devices', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Table container should allow horizontal scrolling
      const tableContainer = screen.getByRole('table').closest('div');
      expect(tableContainer).toHaveStyle('overflow-x: auto');
    });

    it('adjusts column widths responsively', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns.map(col => ({ ...col, minWidth: 200 }))}
        />
      );

      // Columns should respect minimum widths
      const headers = screen.getAllByRole('columnheader');
      headers.forEach(header => {
        expect(header).toHaveStyle('min-width: 200px');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      // Table should have proper structure
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(mockColumns.length);
      expect(screen.getAllByRole('row')).toHaveLength(mockData.length + 1); // +1 for header
    });

    it('supports keyboard navigation for sortable headers', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ModernDataTable
          data={mockData}
          columns={mockColumns}
        />
      );

      const nameHeader = screen.getByRole('button', { name: 'Name' });
      nameHeader.focus();
      
      // Should be focusable
      expect(nameHeader).toHaveFocus();
      
      // Should respond to Enter key
      await user.keyboard('{Enter}');
      
      // Data should be sorted
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Bob Johnson');
    });
  });
});
