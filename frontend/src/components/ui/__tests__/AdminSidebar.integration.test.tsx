import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { AdminNavigationProvider } from '../../../context/AdminNavigationContext';
import AdminSidebar from '../AdminSidebar';

const theme = createTheme();

const renderSidebar = (props: Partial<React.ComponentProps<typeof AdminSidebar>> = {}) => {
  const resolvedProps: React.ComponentProps<typeof AdminSidebar> = {
    isCollapsed: false,
    onToggle: vi.fn(),
    activeSection: 'dashboard',
    isMobile: false,
    onSectionChange: vi.fn(),
    ...props,
  };

  render(
    <ThemeProvider theme={theme}>
      <AdminNavigationProvider>
        <AdminSidebar {...resolvedProps} />
      </AdminNavigationProvider>
    </ThemeProvider>,
  );

  return resolvedProps;
};

describe('AdminSidebar integration', () => {
  it('renders an accessible navigation menu', () => {
    renderSidebar();

    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
    expect(screen.getByRole('menubar', { name: 'Admin Panel' })).toBeInTheDocument();
  });

  it('marks the active section as the current page', () => {
    renderSidebar();

    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('notifies its parent when a navigation item is selected', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderSidebar({ onSectionChange });

    await user.click(screen.getByRole('menuitem', { name: 'Dashboard' }));

    expect(onSectionChange).toHaveBeenCalledWith('dashboard');
  });

  it('expands and collapses grouped sections', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const section = screen.getByRole('button', { name: /System Health section/i });
    const submenu = screen.getByRole('menu', { name: 'System Health submenu' });

    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(submenu).toHaveStyle({ display: 'block' });

    await user.click(section);

    expect(section).toHaveAttribute('aria-expanded', 'false');
    expect(submenu).toHaveStyle({ display: 'none' });
  });

  it('reports child-section selections using their canonical id', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderSidebar({ onSectionChange });

    await user.click(screen.getByRole('menuitem', { name: 'Health Summary' }));

    expect(onSectionChange).toHaveBeenCalledWith('health-summary');
  });

  it('hides labels but preserves accessible names when collapsed', () => {
    renderSidebar({ isCollapsed: true });

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('closes the mobile drawer after a selection', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderSidebar({ isMobile: true, mobileOpen: true, onToggle });

    await user.click(screen.getByRole('menuitem', { name: 'Dashboard' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard activation', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderSidebar({ onSectionChange });
    const dashboard = screen.getByRole('menuitem', { name: 'Dashboard' });
    dashboard.focus();

    await user.keyboard('{Enter}');

    expect(onSectionChange).toHaveBeenCalledWith('dashboard');
  });
});
