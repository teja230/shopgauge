import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SectionErrorBoundary from '../SectionErrorBoundary';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({ 
  shouldThrow = true, 
  errorMessage = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Component that works normally
const WorkingComponent: React.FC = () => {
  return <div>Working component</div>;
};

describe('SectionErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <WorkingComponent />
      </SectionErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Test Section Section Error/i)).toBeInTheDocument();
    expect(screen.getByText(/An error occurred in the Test Section section/i)).toBeInTheDocument();
  });

  it('shows custom fallback message when provided', () => {
    const customMessage = 'Custom error message for testing';
    
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Section" 
        fallbackMessage={customMessage}
      >
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('shows retry button and calls onRetry when clicked', () => {
    const mockRetry = jest.fn();
    
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Section" 
        onRetry={mockRetry}
      >
        <ThrowError />
      </SectionErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows refresh page button', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowError />
      </SectionErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', { name: /refresh page/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('shows error details when showErrorDetails is true', () => {
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Section" 
        showErrorDetails={true}
      >
        <ThrowError errorMessage="Detailed test error" />
      </SectionErrorBoundary>
    );

    // Should have expand button for details
    const expandButton = screen.getByRole('button', { name: '' }); // Icon button
    expect(expandButton).toBeInTheDocument();
  });

  it('renders different UI for component level errors', () => {
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Component" 
        level="component"
      >
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Error in Test Component/i)).toBeInTheDocument();
    // Component level should be more compact
    expect(screen.queryByText(/Test Component Section Error/i)).not.toBeInTheDocument();
  });

  it('renders different UI for page level errors', () => {
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Page" 
        level="page"
      >
        <ThrowError />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Page Error/i)).toBeInTheDocument();
  });

  it('shows report issue button when showErrorDetails is true', () => {
    renderWithTheme(
      <SectionErrorBoundary 
        sectionName="Test Section" 
        showErrorDetails={true}
      >
        <ThrowError />
      </SectionErrorBoundary>
    );

    const reportButton = screen.getByRole('button', { name: /report issue/i });
    expect(reportButton).toBeInTheDocument();
  });

  it('resets error state when retry is clicked', () => {
    let shouldThrow = true;
    const TestComponent = () => <ThrowError shouldThrow={shouldThrow} />;
    
    const { rerender } = renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <TestComponent />
      </SectionErrorBoundary>
    );

    // Should show error initially
    expect(screen.getByText(/Test Section Section Error/i)).toBeInTheDocument();

    // Change the component to not throw
    shouldThrow = false;
    
    // Click retry
    const retryButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryButton);

    // Should reset and show working component
    rerender(
      <SectionErrorBoundary sectionName="Test Section">
        <TestComponent />
      </SectionErrorBoundary>
    );
  });

  it('handles network errors appropriately', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowError errorMessage="Network error: failed to fetch" />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Network connection issue/i)).toBeInTheDocument();
  });

  it('handles chunk loading errors appropriately', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowError errorMessage="ChunkLoadError: Loading chunk 5 failed" />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Failed to load this section/i)).toBeInTheDocument();
  });

  it('handles authentication errors appropriately', () => {
    renderWithTheme(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowError errorMessage="Authentication failed: unauthorized" />
      </SectionErrorBoundary>
    );

    expect(screen.getByText(/Authentication error/i)).toBeInTheDocument();
  });
});