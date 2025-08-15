import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NetworkStatusHandler, { useNetworkStatus } from '../NetworkStatusHandler';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock navigator.onLine
const mockNavigator: any = {
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn((event: Event) => {
      // Simulate actual event dispatching for connection changes
      const listeners = mockNavigator.connection._listeners || [];
      listeners.forEach((listener: any) => {
        if (typeof listener === 'function') {
          listener(event);
        }
      });
    }),
    _listeners: [], // Internal listener storage
  },
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true,
});

// Mock addEventListener and removeEventListener
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true,
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true,
});

// Test component that uses the hook
const TestComponent: React.FC = () => {
  const networkStatus = useNetworkStatus();
  
  return (
    <div>
      <div data-testid="online-status">
        {networkStatus.online ? 'Online' : 'Offline'}
      </div>
      <div data-testid="connection-type">
        {networkStatus.effectiveType || 'Unknown'}
      </div>
      <div data-testid="downlink">
        {networkStatus.downlink || 0}
      </div>
    </div>
  );
};

describe('NetworkStatusHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigator.onLine = true;
  });

  it('renders without crashing', () => {
    renderWithTheme(<NetworkStatusHandler />);
    // Component should render without throwing
  });

  it('shows persistent indicator when enabled', () => {
    renderWithTheme(
      <NetworkStatusHandler showPersistentIndicator={true} />
    );
    
    // Should show the network status indicator
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
  });

  it('shows connection quality when enabled', () => {
    renderWithTheme(
      <NetworkStatusHandler 
        showPersistentIndicator={true}
        showConnectionQuality={true}
      />
    );
    
    // Should show connection quality chip
    expect(screen.getByText(/GOOD/i)).toBeInTheDocument();
  });

  it('calls onNetworkChange when network status changes', () => {
    const mockOnNetworkChange = jest.fn();
    
    renderWithTheme(
      <NetworkStatusHandler onNetworkChange={mockOnNetworkChange} />
    );
    
    // Should call the callback with initial status
    expect(mockOnNetworkChange).toHaveBeenCalled();
  });

  it('shows offline alert when going offline', async () => {
    // Start online
    mockNavigator.onLine = true;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Simulate going offline
    mockNavigator.onLine = false;
    
    // Trigger offline event
    const offlineEvent = new Event('offline');
    
    await act(async () => {
      window.dispatchEvent(offlineEvent);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows reconnected alert when coming back online', async () => {
    // Start offline
    mockNavigator.onLine = false;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Simulate coming online
    mockNavigator.onLine = true;
    
    // Trigger online event
    const onlineEvent = new Event('online');
    
    await act(async () => {
      window.dispatchEvent(onlineEvent);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Restored/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('enables auto retry when offline', async () => {
    // Start online, then go offline to trigger the transition
    mockNavigator.onLine = true;
    
    renderWithTheme(
      <NetworkStatusHandler 
        autoRetry={true}
        retryInterval={1000}
      />
    );
    
    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Go offline to trigger auto retry
    mockNavigator.onLine = false;
    const offlineEvent = new Event('offline');
    
    await act(async () => {
      window.dispatchEvent(offlineEvent);
    });
    
    // Wait for offline alert with auto retry text
    await waitFor(() => {
      expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
    }, { timeout: 2000 });
    
    await waitFor(() => {
      expect(screen.getByText(/Automatically retrying every/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('allows dismissing offline alert', async () => {
    const user = userEvent.setup();
    
    // Start online then go offline to trigger the alert
    mockNavigator.onLine = true;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Go offline to trigger alert
    mockNavigator.onLine = false;
    const offlineEvent = new Event('offline');
    
    await act(async () => {
      window.dispatchEvent(offlineEvent);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Find and click dismiss button - look for any button in the alert
    const dismissButton = screen.getAllByRole('button').find(button => 
      button.querySelector('svg') // Look for the icon button
    );
    
    if (dismissButton) {
      await act(async () => {
        await user.click(dismissButton);
      });
      
      await waitFor(() => {
        expect(screen.queryByText(/Connection Lost/i)).not.toBeInTheDocument();
      }, { timeout: 2000 });
    }
  });

  it('shows retry button in offline alert', async () => {
    // Start online then go offline to trigger the alert
    mockNavigator.onLine = true;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Wait for component to initialize
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Go offline to trigger alert
    mockNavigator.onLine = false;
    const offlineEvent = new Event('offline');
    
    await act(async () => {
      window.dispatchEvent(offlineEvent);
    });
    
    // Wait for the connection lost alert first
    await waitFor(() => {
      expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
    }, { timeout: 2000 });
    
    // Then check for retry button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  describe('useNetworkStatus hook', () => {
    it('returns current network status', () => {
      renderWithTheme(<TestComponent />);
      
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      expect(screen.getByTestId('connection-type')).toHaveTextContent('4g');
      expect(screen.getByTestId('downlink')).toHaveTextContent('10');
    });

    it('updates when network status changes', async () => {
      renderWithTheme(<TestComponent />);
      
      // Initially online
      expect(screen.getByTestId('online-status')).toHaveTextContent('Online');
      
      // Go offline
      mockNavigator.onLine = false;
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);
      
      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('Offline');
      });
    });

    it('handles connection changes', async () => {
      renderWithTheme(<TestComponent />);
      
      // Initially 4g
      expect(screen.getByTestId('connection-type')).toHaveTextContent('4g');
      
      // Change connection type
      mockNavigator.connection.effectiveType = '3g';
      
      // Trigger connection change event - need to call listeners directly
      const connectionChangeEvent = new Event('change');
      Object.defineProperty(connectionChangeEvent, 'target', {
        value: mockNavigator.connection,
        writable: false
      });
      
      // Force a re-render by dispatching to window
      act(() => {
        window.dispatchEvent(connectionChangeEvent);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-type')).toHaveTextContent('3g');
      }, { timeout: 1000 });
    });
  });

  describe('Connection Quality Assessment', () => {
    it('shows good quality for 4g connection', () => {
      mockNavigator.connection.effectiveType = '4g';
      
      renderWithTheme(
        <NetworkStatusHandler 
          showPersistentIndicator={true}
          showConnectionQuality={true}
        />
      );
      
      expect(screen.getByText(/GOOD/i)).toBeInTheDocument();
    });

    it('shows fair quality for 3g connection', () => {
      mockNavigator.connection.effectiveType = '3g';
      
      renderWithTheme(
        <NetworkStatusHandler 
          showPersistentIndicator={true}
          showConnectionQuality={true}
        />
      );
      
      expect(screen.getByText(/FAIR/i)).toBeInTheDocument();
    });

    it('shows poor quality for slow connection', () => {
      mockNavigator.connection.effectiveType = '2g';
      
      renderWithTheme(
        <NetworkStatusHandler 
          showPersistentIndicator={true}
          showConnectionQuality={true}
        />
      );
      
      expect(screen.getByText(/POOR/i)).toBeInTheDocument();
    });
  });

  describe('Connection Details', () => {
    it('shows connection details when expanded', async () => {
      renderWithTheme(
        <NetworkStatusHandler 
          showPersistentIndicator={true}
          showConnectionQuality={true}
        />
      );
      
      // Find and click expand button
      const expandButton = screen.getByRole('button', { name: '' }); // Expand icon
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Connection Details/i)).toBeInTheDocument();
        expect(screen.getByText(/Type: 4G/i)).toBeInTheDocument();
        expect(screen.getByText(/Speed: 10.0 Mbps/i)).toBeInTheDocument();
        expect(screen.getByText(/Latency: 50ms/i)).toBeInTheDocument();
      });
    });

    it('shows data saver status when enabled', async () => {
      mockNavigator.connection.saveData = true;
      
      renderWithTheme(
        <NetworkStatusHandler 
          showPersistentIndicator={true}
          showConnectionQuality={true}
        />
      );
      
      // Expand details
      const expandButton = screen.getByRole('button', { name: '' });
      fireEvent.click(expandButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Data Saver: ON/i)).toBeInTheDocument();
      });
    });
  });
});