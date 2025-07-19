import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AdminNavigationProvider } from '../../../context/AdminNavigationContext';
import AdminSidebar from '../AdminSidebar';
import AdminRouter from '../AdminRouter';

const theme = createTheme();

// Mock location component to track navigation
const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return <div data-testid="current-location">{location.pathname}</div>;
};

// Test wrapper with all necessary providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <AdminNavigationProvider>
        {children}
        <LocationDisplay />
      </AdminNavigationProvider>
    </ThemeProvider>
  </BrowserRouter>
);

// Mock components for different sections
const MockDashboard = () => <div data-testid="dashboard-content">Dashboard Content</div>;
const MockHealthSummary = () => <div data-testid="health-content">Health Summary Content</div>;
const MockSessions = () => <div data-testid="sessions-content">Sessions Content</div>;
const MockAuditLogs = () => <div data-testid="audit-content">Audit Logs Content</div>;

describe('AdminSidebar Integration Tests', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('Navigation Flow', () => {
    it('navigates between sections correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <div style={{ display: 'flex' }}>
            <AdminSidebar />
            <Routes>
              <Route path="/" element={<MockDashboard />} />
              <Route path="/admin" element={<MockDashboard />} />
              <Route path="/admin/dashboard" element={<MockDashboard />} />
              <Route path="/admin/health" element={<MockHealthSummary />} />
              <Route path="/admin/sessions" element={<MockSessions />} />
              <Route path="/admin/audit" element={<MockAuditLogs />} />
            </Routes>
          </div>
        </TestWrapper>
      );

      // Should start with dashboard
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();

      // Navigate to health section
      const healthButton = screen.getByRole('button', { name: /health/i });
      await user.click(healthButton);

      await waitFor(() => {
        expect(screen.getByTestId('health-content')).toBeInTheDocument();
      });

      // Navigate to sessions
      const sessionsButton = screen.getByRole('button', { name: /sessions/i });
      await user.click(sessionsButton);

      await waitFor(() => {
        expect(screen.getByTestId('sessions-content')).toBeInTheDocument();
      });
    });

    it('updates active section state when navigating', async () => {
      const user = userEvent.setup();
      
      const ActiveSectionDisplay: React.FC = () => {
        const { state } = useAdminNavigation();
        return <div data-testid="active-section">{state.activeSection}</div>;
      };

      render(
        <TestWrapper>
          <div style={{ display: 'flex' }}>
            <AdminSidebar />
            <ActiveSectionDisplay />
          </div>
        </TestWrapper>
      );

      // Should start with dashboard
      expect(screen.getByTestId('active-section')).toHaveTextContent('dashboard');

      // Click health section
      const healthButton = screen.getByRole('button', { name: /health/i });
      await user.click(healthButton);

      await waitFor(() => {
        expect(screen.getByTestId('active-section')).toHaveTextContent('health');
      });
    });

    it('highlights active navigation item', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Dashboard should be active initially
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
      expect(dashboardButton).toHaveAttribute('aria-current', 'page');

      // Click health section
      const healthButton = screen.getByRole('button', { name: /health/i });
      await user.click(healthButton);

      await waitFor(() => {
        expect(healthButton).toHaveAttribute('aria-current', 'page');
        expect(dashboardButton).not.toHaveAttribute('aria-current', 'page');
      });
    });
  });

  describe('Sidebar Collapse/Expand', () => {
    it('toggles sidebar collapsed state', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Find toggle button
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      
      // Sidebar should be expanded initially
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('System Health')).toBeInTheDocument();

      // Collapse sidebar
      await user.click(toggleButton);

      await waitFor(() => {
        // Text labels should be hidden when collapsed
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('System Health')).not.toBeInTheDocument();
      });

      // Expand sidebar again
      await user.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('System Health')).toBeInTheDocument();
      });
    });

    it('shows tooltips when sidebar is collapsed', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Collapse sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await user.click(toggleButton);

      // Hover over dashboard icon
      const dashboardIcon = screen.getByRole('button', { name: /dashboard/i });
      await user.hover(dashboardIcon);

      await waitFor(() => {
        expect(screen.getByRole('tooltip', { name: /dashboard/i })).toBeInTheDocument();
      });
    });

    it('maintains navigation functionality when collapsed', async () => {
      const user = userEvent.setup();
      
      const ActiveSectionDisplay: React.FC = () => {
        const { state } = useAdminNavigation();
        return <div data-testid="active-section">{state.activeSection}</div>;
      };

      render(
        <TestWrapper>
          <div style={{ display: 'flex' }}>
            <AdminSidebar />
            <ActiveSectionDisplay />
          </div>
        </TestWrapper>
      );

      // Collapse sidebar
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await user.click(toggleButton);

      // Navigate while collapsed
      const healthButton = screen.getByRole('button', { name: /health/i });
      await user.click(healthButton);

      await waitFor(() => {
        expect(screen.getByTestId('active-section')).toHaveTextContent('health');
      });
    });
  });

  describe('Expandable Sections', () => {
    it('expands and collapses section groups', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Find system health section
      const systemHealthSection = screen.getByRole('button', { name: /system health/i });
      
      // Sub-items should be visible initially (expanded by default)
      expect(screen.getByText('Health Summary')).toBeInTheDocument();
      expect(screen.getByText('Connection Pool')).toBeInTheDocument();

      // Collapse section
      await user.click(systemHealthSection);

      await waitFor(() => {
        expect(screen.queryByText('Health Summary')).not.toBeInTheDocument();
        expect(screen.queryByText('Connection Pool')).not.toBeInTheDocument();
      });

      // Expand section again
      await user.click(systemHealthSection);

      await waitFor(() => {
        expect(screen.getByText('Health Summary')).toBeInTheDocument();
        expect(screen.getByText('Connection Pool')).toBeInTheDocument();
      });
    });

    it('shows expand/collapse icons correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      const systemHealthSection = screen.getByRole('button', { name: /system health/i });
      
      // Should show collapse icon when expanded
      expect(systemHealthSection.querySelector('[data-testid="ExpandLessIcon"]')).toBeInTheDocument();

      // Collapse section
      await user.click(systemHealthSection);

      await waitFor(() => {
        expect(systemHealthSection.querySelector('[data-testid="ExpandMoreIcon"]')).toBeInTheDocument();
      });
    });

    it('maintains section state when sidebar is toggled', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Collapse a section
      const systemHealthSection = screen.getByRole('button', { name: /system health/i });
      await user.click(systemHealthSection);

      await waitFor(() => {
        expect(screen.queryByText('Health Summary')).not.toBeInTheDocument();
      });

      // Toggle sidebar collapsed/expanded
      const toggleButton = screen.getByRole('button', { name: /toggle sidebar/i });
      await user.click(toggleButton); // Collapse
      await user.click(toggleButton); // Expand

      // Section should still be collapsed
      await waitFor(() => {
        expect(screen.queryByText('Health Summary')).not.toBeInTheDocument();
      });
    });
  });

  describe('Badge Indicators', () => {
    it('displays notification badges', () => {
      const BadgeTestComponent: React.FC = () => {
        const { addNotification } = useAdminNavigation();
        
        React.useEffect(() => {
          // Add some notifications for testing
          addNotification({ title: 'Test 1', message: 'Message 1', type: 'error' });
          addNotification({ title: 'Test 2', message: 'Message 2', type: 'warning' });
        }, [addNotification]);

        return <AdminSidebar />;
      };

      render(
        <TestWrapper>
          <BadgeTestComponent />
        </TestWrapper>
      );

      // Should show notification badge
      const notificationBadge = screen.getByText('2');
      expect(notificationBadge).toBeInTheDocument();
    });

    it('updates badge count when notifications change', async () => {
      const user = userEvent.setup();
      
      const BadgeUpdateComponent: React.FC = () => {
        const { addNotification, clearNotifications } = useAdminNavigation();
        
        return (
          <div>
            <AdminSidebar />
            <button onClick={() => addNotification({ title: 'Test', message: 'Message', type: 'info' })}>
              Add Notification
            </button>
            <button onClick={clearNotifications}>Clear Notifications</button>
          </div>
        );
      };

      render(
        <TestWrapper>
          <BadgeUpdateComponent />
        </TestWrapper>
      );

      // Add notifications
      await user.click(screen.getByText('Add Notification'));
      await user.click(screen.getByText('Add Notification'));

      expect(screen.getByText('2')).toBeInTheDocument();

      // Clear notifications
      await user.click(screen.getByText('Clear Notifications'));

      await waitFor(() => {
        expect(screen.queryByText('2')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation between items', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Focus first navigation item
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
      dashboardButton.focus();

      expect(dashboardButton).toHaveFocus();

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      
      const healthButton = screen.getByRole('button', { name: /system health/i });
      expect(healthButton).toHaveFocus();
    });

    it('activates items with Enter key', async () => {
      const user = userEvent.setup();
      
      const ActiveSectionDisplay: React.FC = () => {
        const { state } = useAdminNavigation();
        return <div data-testid="active-section">{state.activeSection}</div>;
      };

      render(
        <TestWrapper>
          <div style={{ display: 'flex' }}>
            <AdminSidebar />
            <ActiveSectionDisplay />
          </div>
        </TestWrapper>
      );

      // Focus health button and activate with Enter
      const healthButton = screen.getByRole('button', { name: /health summary/i });
      healthButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('active-section')).toHaveTextContent('health');
      });
    });

    it('supports Space key activation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Focus section header and toggle with Space
      const systemHealthSection = screen.getByRole('button', { name: /system health/i });
      systemHealthSection.focus();
      
      // Should be expanded initially
      expect(screen.getByText('Health Summary')).toBeInTheDocument();

      await user.keyboard(' '); // Space key

      await waitFor(() => {
        expect(screen.queryByText('Health Summary')).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query.includes('(max-width: 768px)'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // On mobile, sidebar should be in drawer mode
      // This would require more sophisticated testing of the responsive behavior
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('handles touch interactions on mobile', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Touch interactions should work the same as click
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
      
      // Simulate touch
      await user.pointer({ keys: '[TouchA>]', target: dashboardButton });
      await user.pointer({ keys: '[/TouchA]' });

      // Should maintain functionality
      expect(dashboardButton).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA structure', () => {
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Should have navigation landmark
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      
      // Should have proper button roles
      expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /system health/i })).toBeInTheDocument();
    });

    it('provides proper focus management', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Should be able to focus navigation items
      const dashboardButton = screen.getByRole('button', { name: /dashboard/i });
      await user.tab();
      
      expect(dashboardButton).toHaveFocus();
    });

    it('announces state changes to screen readers', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <AdminSidebar />
        </TestWrapper>
      );

      // Expandable sections should have proper ARIA attributes
      const systemHealthSection = screen.getByRole('button', { name: /system health/i });
      expect(systemHealthSection).toHaveAttribute('aria-expanded', 'true');

      await user.click(systemHealthSection);

      await waitFor(() => {
        expect(systemHealthSection).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });
});