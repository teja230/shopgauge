import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { 
  AdminNavigationProvider, 
  useAdminNavigation,
  type BreadcrumbItem,
  type NotificationItem,
  type AdminUser 
} from '../AdminNavigationContext';

// Test component to access context
const TestComponent: React.FC = () => {
  const {
    state,
    setActiveSection,
    setSidebarCollapsed,
    setBreadcrumbs,
    addNotification,
    markNotificationRead,
    clearNotifications,
    setUser,
  } = useAdminNavigation();

  return (
    <div>
      <div data-testid="active-section">{state.activeSection}</div>
      <div data-testid="sidebar-collapsed">{state.sidebarCollapsed.toString()}</div>
      <div data-testid="breadcrumbs">{JSON.stringify(state.breadcrumbs)}</div>
      <div data-testid="notifications-count">{state.notifications.length}</div>
      <div data-testid="user">{state.user ? JSON.stringify(state.user) : 'null'}</div>
      
      <button onClick={() => setActiveSection('health')}>Set Health Section</button>
      <button onClick={() => setSidebarCollapsed(true)}>Collapse Sidebar</button>
      <button onClick={() => setBreadcrumbs([{ label: 'Test', path: '/test' }])}>Set Breadcrumbs</button>
      <button onClick={() => addNotification({ title: 'Test', message: 'Test message', type: 'info' })}>Add Notification</button>
      <button onClick={() => markNotificationRead(state.notifications[0]?.id)}>Mark First Read</button>
      <button onClick={() => clearNotifications()}>Clear Notifications</button>
      <button onClick={() => setUser({ username: 'admin', role: 'administrator' })}>Set User</button>
    </div>
  );
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <AdminNavigationProvider>
      {component}
    </AdminNavigationProvider>
  );
};

describe('AdminNavigationContext', () => {
  describe('Initial State', () => {
    it('provides default state values', () => {
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId('active-section')).toHaveTextContent('dashboard');
      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false');
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('[{"label":"Dashboard","icon":null}]');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('Active Section Management', () => {
    it('updates active section', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      await user.click(screen.getByText('Set Health Section'));

      expect(screen.getByTestId('active-section')).toHaveTextContent('health');
    });

    it('maintains active section state across re-renders', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProvider(<TestComponent />);

      await user.click(screen.getByText('Set Health Section'));
      expect(screen.getByTestId('active-section')).toHaveTextContent('health');

      rerender(
        <AdminNavigationProvider>
          <TestComponent />
        </AdminNavigationProvider>
      );

      // Rerender reconciles the provider at the same tree position, so its state is preserved.
      expect(screen.getByTestId('active-section')).toHaveTextContent('health');
    });
  });

  describe('Sidebar State Management', () => {
    it('toggles sidebar collapsed state', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false');

      await user.click(screen.getByText('Collapse Sidebar'));

      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('true');
    });
  });

  describe('Breadcrumbs Management', () => {
    it('updates breadcrumbs', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      await user.click(screen.getByText('Set Breadcrumbs'));

      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('[{"label":"Test","path":"/test"}]');
    });

    it('replaces existing breadcrumbs', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      // Set initial breadcrumbs
      await user.click(screen.getByText('Set Breadcrumbs'));
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('[{"label":"Test","path":"/test"}]');

      // Set new breadcrumbs should replace, not append
      await user.click(screen.getByText('Set Breadcrumbs'));
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('[{"label":"Test","path":"/test"}]');
    });
  });

  describe('Notifications Management', () => {
    it('adds notifications', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');

      await user.click(screen.getByText('Add Notification'));

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
    });

    it('adds multiple notifications', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      await user.click(screen.getByText('Add Notification'));
      await user.click(screen.getByText('Add Notification'));
      await user.click(screen.getByText('Add Notification'));

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('3');
    });

    it('limits notifications to 50', async () => {
      const user = userEvent.setup();
      
      // Component that adds many notifications
      const ManyNotificationsComponent: React.FC = () => {
        const { state, addNotification } = useAdminNavigation();

        const addManyNotifications = () => {
          for (let i = 0; i < 60; i++) {
            addNotification({ 
              title: `Notification ${i}`, 
              message: `Message ${i}`, 
              type: 'info' 
            });
          }
        };

        return (
          <div>
            <div data-testid="notifications-count">{state.notifications.length}</div>
            <button onClick={addManyNotifications}>Add Many Notifications</button>
          </div>
        );
      };

      renderWithProvider(<ManyNotificationsComponent />);

      await user.click(screen.getByText('Add Many Notifications'));

      expect(screen.getByTestId('notifications-count')).toHaveTextContent('50');
    });

    it('marks notifications as read', async () => {
      const user = userEvent.setup();
      
      const NotificationTestComponent: React.FC = () => {
        const { state, addNotification, markNotificationRead } = useAdminNavigation();

        return (
          <div>
            <div data-testid="first-notification-read">
              {state.notifications[0]?.read?.toString() || 'no-notification'}
            </div>
            <button onClick={() => addNotification({ title: 'Test', message: 'Test message', type: 'info' })}>
              Add Notification
            </button>
            <button onClick={() => markNotificationRead(state.notifications[0]?.id)}>
              Mark First Read
            </button>
          </div>
        );
      };

      renderWithProvider(<NotificationTestComponent />);

      await user.click(screen.getByText('Add Notification'));
      expect(screen.getByTestId('first-notification-read')).toHaveTextContent('false');

      await user.click(screen.getByText('Mark First Read'));
      expect(screen.getByTestId('first-notification-read')).toHaveTextContent('true');
    });

    it('clears all notifications', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      // Add some notifications
      await user.click(screen.getByText('Add Notification'));
      await user.click(screen.getByText('Add Notification'));
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('2');

      await user.click(screen.getByText('Clear Notifications'));
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('0');
    });

    it('creates notifications with correct structure', async () => {
      const user = userEvent.setup();
      
      const NotificationStructureComponent: React.FC = () => {
        const { state, addNotification } = useAdminNavigation();

        return (
          <div>
            <div data-testid="notification-data">
              {state.notifications[0] ? JSON.stringify({
                hasId: !!state.notifications[0].id,
                hasTimestamp: !!state.notifications[0].timestamp,
                read: state.notifications[0].read,
                title: state.notifications[0].title,
                message: state.notifications[0].message,
                type: state.notifications[0].type,
              }) : 'no-notification'}
            </div>
            <button onClick={() => addNotification({ 
              title: 'Test Title', 
              message: 'Test Message', 
              type: 'warning' 
            })}>
              Add Notification
            </button>
          </div>
        );
      };

      renderWithProvider(<NotificationStructureComponent />);

      await user.click(screen.getByText('Add Notification'));

      const notificationData = JSON.parse(screen.getByTestId('notification-data').textContent!);
      expect(notificationData).toEqual({
        hasId: true,
        hasTimestamp: true,
        read: false,
        title: 'Test Title',
        message: 'Test Message',
        type: 'warning',
      });
    });
  });

  describe('User Management', () => {
    it('sets user data', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      expect(screen.getByTestId('user')).toHaveTextContent('null');

      await user.click(screen.getByText('Set User'));

      expect(screen.getByTestId('user')).toHaveTextContent('{"username":"admin","role":"administrator"}');
    });

    it('clears user data', async () => {
      const user = userEvent.setup();
      
      const UserTestComponent: React.FC = () => {
        const { state, setUser } = useAdminNavigation();

        return (
          <div>
            <div data-testid="user">{state.user ? JSON.stringify(state.user) : 'null'}</div>
            <button onClick={() => setUser({ username: 'admin', role: 'administrator' })}>
              Set User
            </button>
            <button onClick={() => setUser(null)}>Clear User</button>
          </div>
        );
      };

      renderWithProvider(<UserTestComponent />);

      await user.click(screen.getByText('Set User'));
      expect(screen.getByTestId('user')).toHaveTextContent('{"username":"admin","role":"administrator"}');

      await user.click(screen.getByText('Clear User'));
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  describe('Context Provider Error Handling', () => {
    it('throws error when useAdminNavigation is used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      const ComponentWithoutProvider: React.FC = () => {
        useAdminNavigation();
        return <div>Should not render</div>;
      };

      expect(() => render(<ComponentWithoutProvider />)).toThrow(
        'useAdminNavigation must be used within an AdminNavigationProvider'
      );

      console.error = originalError;
    });
  });

  describe('State Persistence and Updates', () => {
    it('maintains state consistency across multiple updates', async () => {
      const user = userEvent.setup();
      renderWithProvider(<TestComponent />);

      // Perform multiple state updates
      await user.click(screen.getByText('Set Health Section'));
      await user.click(screen.getByText('Collapse Sidebar'));
      await user.click(screen.getByText('Set Breadcrumbs'));
      await user.click(screen.getByText('Add Notification'));
      await user.click(screen.getByText('Set User'));

      // Verify all states are maintained
      expect(screen.getByTestId('active-section')).toHaveTextContent('health');
      expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('true');
      expect(screen.getByTestId('breadcrumbs')).toHaveTextContent('[{"label":"Test","path":"/test"}]');
      expect(screen.getByTestId('notifications-count')).toHaveTextContent('1');
      expect(screen.getByTestId('user')).toHaveTextContent('{"username":"admin","role":"administrator"}');
    });

    it('handles rapid state updates correctly', async () => {
      const user = userEvent.setup();
      
      const RapidUpdatesComponent: React.FC = () => {
        const { state, setActiveSection } = useAdminNavigation();

        const rapidUpdates = () => {
          setActiveSection('health');
          setActiveSection('sessions');
          setActiveSection('audit');
          setActiveSection('monitoring');
        };

        return (
          <div>
            <div data-testid="active-section">{state.activeSection}</div>
            <button onClick={rapidUpdates}>Rapid Updates</button>
          </div>
        );
      };

      renderWithProvider(<RapidUpdatesComponent />);

      await user.click(screen.getByText('Rapid Updates'));

      // Should have the last update
      expect(screen.getByTestId('active-section')).toHaveTextContent('monitoring');
    });
  });

  describe('Callback Stability', () => {
    it('provides stable callback references', () => {
      let callbacks: any = {};
      
      const CallbackTestComponent: React.FC = () => {
        const navigation = useAdminNavigation();
        
        // Store callbacks on first render
        if (Object.keys(callbacks).length === 0) {
          callbacks = {
            setActiveSection: navigation.setActiveSection,
            setSidebarCollapsed: navigation.setSidebarCollapsed,
            setBreadcrumbs: navigation.setBreadcrumbs,
            addNotification: navigation.addNotification,
            markNotificationRead: navigation.markNotificationRead,
            clearNotifications: navigation.clearNotifications,
            setUser: navigation.setUser,
          };
        }

        return (
          <div data-testid="callbacks-stable">
            {Object.keys(callbacks).every(key => callbacks[key] === (navigation as any)[key]).toString()}
          </div>
        );
      };

      const { rerender } = renderWithProvider(<CallbackTestComponent />);

      expect(screen.getByTestId('callbacks-stable')).toHaveTextContent('true');

      // Force re-render
      rerender(
        <AdminNavigationProvider>
          <CallbackTestComponent />
        </AdminNavigationProvider>
      );

      // The provider is reconciled in place, so memoized callbacks remain stable.
      expect(screen.getByTestId('callbacks-stable')).toHaveTextContent('true');
    });
  });
});
