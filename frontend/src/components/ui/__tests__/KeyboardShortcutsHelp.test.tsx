import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp';
import type { KeyboardShortcut } from '../../../hooks/useKeyboardNavigation';

const theme = createTheme();

const mockShortcuts: KeyboardShortcut[] = [
  {
    key: 'b',
    ctrlKey: true,
    description: 'Toggle sidebar',
    action: jest.fn(),
  },
  {
    key: 'r',
    ctrlKey: true,
    description: 'Refresh data',
    action: jest.fn(),
  },
  {
    key: '?',
    description: 'Show keyboard shortcuts',
    action: jest.fn(),
  },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('KeyboardShortcutsHelp', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders keyboard shortcuts dialog when open', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Toggle sidebar')).toBeInTheDocument();
    expect(screen.getByText('Refresh data')).toBeInTheDocument();
    expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={false}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays keyboard shortcut keys correctly', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    // Check for Ctrl+B shortcut
    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    // Check for Ctrl+R shortcut
    expect(screen.getByText('R')).toBeInTheDocument();

    // Check for ? shortcut
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    const closeButton = screen.getByLabelText('Close keyboard shortcuts help');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Got it button is clicked', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    const gotItButton = screen.getByText('Got it');
    fireEvent.click(gotItButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA labels and roles', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'keyboard-shortcuts-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'keyboard-shortcuts-description');

    expect(screen.getByText('Keyboard Shortcuts')).toHaveAttribute('id', 'keyboard-shortcuts-title');
  });

  it('displays accessibility tips section', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    expect(screen.getByText('Accessibility Tips:')).toBeInTheDocument();
    expect(screen.getByText(/Use Tab and Shift\+Tab to navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Use Arrow keys to navigate within menus/)).toBeInTheDocument();
  });

  it('groups shortcuts by category', () => {
    renderWithTheme(
      <KeyboardShortcutsHelp
        open={true}
        onClose={mockOnClose}
        shortcuts={mockShortcuts}
      />
    );

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });
});