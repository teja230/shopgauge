import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi } from 'vitest';
import { SessionLimitDialog } from '../SessionLimitDialog';

const sessions = [
  {
    sessionId: 'current-session',
    isCurrentSession: true,
    createdAt: '2026-07-14T10:00:00',
    lastAccessedAt: '2026-07-14T10:00:00',
    lastUsedFormatted: 'Just now',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/126.0',
    isExpired: false,
  },
  {
    sessionId: 'other-session',
    isCurrentSession: false,
    createdAt: '2026-07-14T09:00:00',
    lastAccessedAt: '2026-07-14T09:00:00',
    lastUsedFormatted: '1 hour ago',
    ipAddress: '10.0.0.2',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/126.0',
    isExpired: false,
  },
];

const renderDialog = (onSessionsDeleted: ReturnType<typeof vi.fn>) => render(
  <ThemeProvider theme={createTheme()}>
    <SessionLimitDialog
      open
      onClose={vi.fn()}
      onSessionDeleted={vi.fn()}
      onSessionsDeleted={onSessionsDeleted}
      onContinue={vi.fn()}
      sessions={sessions}
    />
  </ThemeProvider>,
);

describe('SessionLimitDialog', () => {
  it('deletes only the selected non-current session', async () => {
    const user = userEvent.setup();
    const onSessionsDeleted = vi.fn().mockResolvedValue({ success: 1, failed: 0 });
    renderDialog(onSessionsDeleted);

    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));

    await waitFor(() => {
      expect(onSessionsDeleted).toHaveBeenCalledWith(['other-session']);
    });
    expect(screen.queryByText('Session not removed')).not.toBeInTheDocument();
  });

  it('keeps the selection and shows recovery guidance when deletion fails', async () => {
    const user = userEvent.setup();
    const onSessionsDeleted = vi.fn().mockResolvedValue({
      success: 0,
      failed: 1,
      error: 'Access denied',
    });
    renderDialog(onSessionsDeleted);

    await user.click(await screen.findByRole('button', { name: 'Select' }));
    await user.click(screen.getByRole('button', { name: /delete selected/i }));

    expect(await screen.findByText('Session not removed')).toBeInTheDocument();
    expect(screen.getByText(/refresh the page and try again/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete selected/i })).toBeInTheDocument();
  });
});
