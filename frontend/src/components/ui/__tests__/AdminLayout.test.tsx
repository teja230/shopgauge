import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AdminNavigationProvider } from '../../../context/AdminNavigationContext';
import { NotificationSettingsProvider } from '../../../context/NotificationSettingsContext';
import AdminLayout from '../AdminLayout';
import { describe, it, expect, vi } from 'vitest';

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <NotificationSettingsProvider>
      <AdminNavigationProvider>
        {children}
      </AdminNavigationProvider>
    </NotificationSettingsProvider>
  </ThemeProvider>
);

describe('AdminLayout', () => {
  const defaultProps = {
    currentSection: 'dashboard',
    onSectionChange: vi.fn(),
    onLogout: vi.fn(),
    children: <div>Test Content</div>
  };

  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <AdminLayout {...defaultProps} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders admin panel header', () => {
    render(
      <TestWrapper>
        <AdminLayout {...defaultProps} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
  });

  it('renders dashboard as default breadcrumb', () => {
    render(
      <TestWrapper>
        <AdminLayout {...defaultProps} />
      </TestWrapper>
    );
    
    // Check for Dashboard in the sidebar navigation
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
