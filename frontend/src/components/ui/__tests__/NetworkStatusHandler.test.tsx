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
const mockNavigator = {
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    saveData: false,
  },
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true,
});

// Mock addEventListener and removeEventListener
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
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
    jest.clearAllMocks();
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
    
    // Simulate going offline
    mockNavigator.onLine = false;
    
    // Trigger offline event
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
    });
  });

  it('shows reconnected alert when coming back online', async () => {
    // Start offline
    mockNavigator.onLine = false;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Simulate coming online
    mockNavigator.onLine = true;
    
    // Trigger online event
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Restored/i)).toBeInTheDocument();
    });
  });

  it('enables auto retry when offline', () => {
    mockNavigator.onLine = false;
    
    renderWithTheme(
      <NetworkStatusHandler 
        autoRetry={true}
        retryInterval={1000}
      />
    );
    
    // Should show auto retry information
    expect(screen.getByText(/Automatically retrying/i)).toBeInTheDocument();
  });

  it('allows dismissing offline alert', async () => {
    mockNavigator.onLine = false;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Trigger offline event to show alert
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
    
    await waitFor(() => {
      expect(screen.getByText(/Connection Lost/i)).toBeInTheDocument();
    });
    
    // Find and click dismiss button
    const dismissButton = screen.getByRole('button', { name: '' }); // Close icon
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/Connection Lost/i)).not.toBeInTheDocument();
    });
  });

  it('shows retry button in offline alert', async () => {
    mockNavigator.onLine = false;
    
    renderWithTheme(<NetworkStatusHandler />);
    
    // Trigger offline event
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
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
      
      // Trigger connection change event
      const connectionChangeEvent = new Event('change');
      mockNavigator.connection.dispatchEvent(connectionChangeEvent);
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-type')).toHaveTextContent('3g');
      });
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