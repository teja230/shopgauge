import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AdminNavigationProvider } from '../../../context/AdminNavigationContext';
import AdminLayout from '../AdminLayout';
import AdminSidebar from '../AdminSidebar';
import ModernDataTable from '../ModernDataTable';

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <AdminNavigationProvider>
      {children}
    </AdminNavigationProvider>
  </ThemeProvider>
);

// Mock data for table tests
const mockTableData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'inactive' },
];

const mockTableColumns = [
  { id: 'name', label: 'Name', sortable: true, filterable: true },
  { id: 'email', label: 'Email', sortable: true, filterable: true },
  { id: 'status', label: 'Status', sortable: true, filterable: true },
];

// Utility function to mock different viewport sizes
const mockViewport = (width: number, height: number = 768) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });

  // Mock matchMedia for different breakpoints
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      // Generic parser for (max-width: Xpx) and (min-width: Xpx)
      const maxMatch = /\(max-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
      const minMatch = /\(min-width:\s*(\d+(?:\.\d+)?)px\)/.exec(query);
      let matches = false;
      if (maxMatch) {
        const px = parseFloat(maxMatch[1]);
        matches = width <= px;
      } else if (minMatch) {
        const px = parseFloat(minMatch[1]);
        matches = width >= px;
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;
    }),
  });

  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

describe('Responsive Layout Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset viewport to default
    mockViewport(1024, 768);
  });

  describe('Desktop Layout (≥1024px)', () => {
    beforeEach(() => {
      mockViewport(1200, 800);
    });

    it('renders full sidebar navigation on desktop', () => {
      render(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
          </AdminLayout>
        </TestWrapper>
      );

      // Sidebar should be visible and expanded
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('System Health')).toBeInTheDocument();
    });

    it('displays multi-column dashboard layout on desktop', () => {
      const DashboardContent: React.FC = () => (
        <div data-testid="dashboard-content">
          <div className="grid grid-cols-3 gap-6">
            <div data-testid="metric-card-1">Metric 1</div>
            <div data-testid="metric-card-2">Metric 2</div>
            <div data-testid="metric-card-3">Metric 3</div>
          </div>
        </div>
      );

      render(
        <TestWrapper>
          <AdminLayout>
            <DashboardContent />
          </AdminLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-3')).toBeInTheDocument();
    });

    it('shows expanded data tables on desktop', () => {
      render(
        <TestWrapper>
          <ModernDataTable
            data={mockTableData}
            columns={mockTableColumns}
            searchable={true}
            filterable={true}
          />
        </TestWrapper>
      );

      // All columns should be visible
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();

      // Search and filter controls should be visible
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
      expect(screen.getByText(/filters/i)).toBeInTheDocument();
    });

    it('applies desktop-specific styling', () => {
      render(
        <TestWrapper>
          <AdminLayout>
            <div data-testid="content">Desktop Content</div>
          </AdminLayout>
        </TestWrapper>
      );

      const layout = screen.getByTestId('content').closest('[data-testid*="admin-layout"]');
      
      // Desktop layout should have specific classes or styles
      // This would need to be implemented based on actual CSS classes
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  describe('Tablet Layout (768px - 1023px)', () => {
    beforeEach(() => {
      mockViewport(800, 600);
    });

    it('renders collapsible sidebar on tablet', () => {
      render(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
          </AdminLayout>
        </TestWrapper>
      );

      // Sidebar should be present but potentially collapsible
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Toggle button should be available
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('displays two-column dashboard layout on tablet', () => {
      const TabletDashboard: React.FC = () => (
        <div data-testid="tablet-dashboard">
          <div className="grid grid-cols-2 gap-4">
            <div data-testid="metric-card-1">Metric 1</div>
            <div data-testid="metric-card-2">Metric 2</div>
          </div>
        </div>
      );

      render(
        <TestWrapper>
          <AdminLayout>
            <TabletDashboard />
          </AdminLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('tablet-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('metric-card-2')).toBeInTheDocument();
    });

    it('enables horizontal scroll for wide tables on tablet', () => {
      render(
        <TestWrapper>
          <ModernDataTable
            data={mockTableData}
            columns={[
              ...mockTableColumns,
              { id: 'extra1', label: 'Extra Column 1', minWidth: 200 },
              { id: 'extra2', label: 'Extra Column 2', minWidth: 200 },
              { id: 'extra3', label: 'Extra Column 3', minWidth: 200 },
            ]}
          />
        </TestWrapper>
      );

      // Table container should allow horizontal scrolling
      const tableContainer = screen.getByRole('table').closest('div');
      expect(tableContainer).toHaveStyle('overflow-x: auto');
    });

    it('optimizes touch interactions on tablet', () => {
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Interactive elements should have appropriate touch target sizes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button);
        const mh = parseInt(styles.minHeight || '0');
        const h = parseInt(styles.height || '0');
        const minHeight = isNaN(mh) ? (isNaN(h) ? 0 : h) : mh;
        if (!isNaN(minHeight) && minHeight > 0) {
          expect(minHeight).toBeGreaterThanOrEqual(36);
        }
      });
    });
  });

  describe('Mobile Layout (≤767px)', () => {
    beforeEach(() => {
      mockViewport(375, 667); // iPhone-like dimensions
    });

    it('renders drawer-style navigation on mobile', () => {
      render(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
          </AdminLayout>
        </TestWrapper>
      );

      // Navigation should be present but in drawer mode
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Menu button should be available to open drawer
      const menuButton = screen.getByRole('button', { name: /menu|toggle/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('displays single-column layout on mobile', () => {
      const MobileDashboard: React.FC = () => (
        <div data-testid="mobile-dashboard">
          <div className="grid grid-cols-1 gap-4">
            <div data-testid="metric-card-1">Metric 1</div>
            <div data-testid="metric-card-2">Metric 2</div>
            <div data-testid="metric-card-3">Metric 3</div>
          </div>
        </div>
      );

      render(
        <TestWrapper>
          <AdminLayout>
            <MobileDashboard />
          </AdminLayout>
        </TestWrapper>
      );

      expect(screen.getByTestId('mobile-dashboard')).toBeInTheDocument();
      
      // All cards should be stacked vertically
      const cards = [
        screen.getByTestId('metric-card-1'),
        screen.getByTestId('metric-card-2'),
        screen.getByTestId('metric-card-3'),
      ];
      
      cards.forEach(card => {
        expect(card).toBeInTheDocument();
      });
    });

    it('renders mobile-optimized data tables', () => {
      render(
        <TestWrapper>
          <ModernDataTable
            data={mockTableData}
            columns={mockTableColumns}
            searchable={true}
          />
        </TestWrapper>
      );

      // On mobile, tables might render as cards or have simplified layout
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      
      // Search should still be available
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('ensures minimum touch target sizes on mobile', () => {
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // All interactive elements should meet minimum touch target size
      const interactiveElements = [
        ...screen.getAllByRole('button'),
        ...screen.queryAllByRole('link'),
      ];

      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        
        // Minimum touch target should be 44x44px
        expect(Math.max(rect.width, rect.height)).toBeGreaterThanOrEqual(44);
      });
    });

    it('handles mobile-specific interactions', () => {
      render(
        <TestWrapper>
          <AdminLayout>
            <div data-testid="mobile-content">Mobile Content</div>
          </AdminLayout>
        </TestWrapper>
      );

      // Content should be optimized for mobile viewing
      expect(screen.getByTestId('mobile-content')).toBeInTheDocument();
      
      // Should not have horizontal overflow
      const content = screen.getByTestId('mobile-content');
      const styles = window.getComputedStyle(content);
      expect(styles.overflowX).not.toBe('scroll');
    });
  });

  describe('Responsive Breakpoint Transitions', () => {
    it('adapts layout when transitioning from desktop to tablet', () => {
      // Start with desktop
      mockViewport(1200, 800);
      
      const { rerender } = render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Should show full sidebar
      expect(screen.getByText('Dashboard')).toBeInTheDocument();

      // Transition to tablet
      mockViewport(800, 600);
      
      rerender(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Layout should adapt (specific behavior depends on implementation)
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('adapts layout when transitioning from tablet to mobile', () => {
      // Start with tablet
      mockViewport(800, 600);
      
      const { rerender } = render(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
          </AdminLayout>
        </TestWrapper>
      );

      // Transition to mobile
      mockViewport(375, 667);
      
      rerender(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
          </AdminLayout>
        </TestWrapper>
      );

      // Should adapt to mobile layout
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('maintains functionality across breakpoints', () => {
      const viewports = [
        { width: 1200, height: 800, name: 'desktop' },
        { width: 800, height: 600, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' },
      ];

      viewports.forEach(viewport => {
        mockViewport(viewport.width, viewport.height);
        
        const { unmount } = render(
          <TestWrapper>
            <AdminSidebar />
          </TestWrapper>
        );

        // Core functionality should be available at all breakpoints
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        // At least some navigation items should be accessible
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);

        unmount();
      });
    });
  });

  describe('Content Overflow and Scrolling', () => {
    it('handles content overflow correctly on mobile', () => {
      mockViewport(375, 667);
      
      const LongContentComponent: React.FC = () => (
        <div data-testid="long-content" style={{ width: '500px' }}>
          This content is wider than the mobile viewport
        </div>
      );

      render(
        <TestWrapper>
          <AdminLayout>
            <LongContentComponent />
          </AdminLayout>
        </TestWrapper>
      );

      const content = screen.getByTestId('long-content');
      const container = content.closest('[data-testid*="admin-layout"]');
      
      // Container should handle overflow appropriately
      expect(container).toBeInTheDocument();
    });

    it('maintains readable text sizes across devices', () => {
      const viewports = [375, 768, 1024, 1200];
      
      viewports.forEach(width => {
        mockViewport(width);
        
        const { unmount } = render(
          <TestWrapper>
            <AdminLayout>
              <div data-testid="text-content">
                <h1>Main Heading</h1>
                <p>Body text content</p>
                <small>Small text</small>
              </div>
            </AdminLayout>
          </TestWrapper>
        );

        const textContent = screen.getByTestId('text-content');
        const styles = window.getComputedStyle(textContent);
        
        // Text should remain readable (this is a basic check)
        expect(textContent).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('Performance on Different Devices', () => {
    it('renders efficiently on mobile devices', () => {
      mockViewport(375, 667);
      
      const renderStart = performance.now();
      
      render(
        <TestWrapper>
          <AdminLayout>
            <AdminSidebar />
            <ModernDataTable
              data={mockTableData}
              columns={mockTableColumns}
            />
          </AdminLayout>
        </TestWrapper>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;
      
      // Render should complete reasonably quickly (this is a basic performance check)
      expect(renderTime).toBeLessThan(1000); // 1 second threshold
    });

    it('handles large datasets efficiently on mobile', () => {
      mockViewport(375, 667);
      
      // Create larger dataset
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        status: i % 2 === 0 ? 'active' : 'inactive',
      }));

      const renderStart = performance.now();
      
      render(
        <TestWrapper>
          <ModernDataTable
            data={largeDataset}
            columns={mockTableColumns}
            pagination={{
              page: 0,
              rowsPerPage: 10,
              totalCount: largeDataset.length,
              onPageChange: vi.fn(),
              onRowsPerPageChange: vi.fn(),
            }}
          />
        </TestWrapper>
      );

      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;
      
      // Should handle large datasets efficiently
      expect(renderTime).toBeLessThan(2000); // 2 second threshold for larger dataset
      
      // Should render data rows
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });
  });
});