import React, { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceStatusProvider } from '../context/ServiceStatusContext';
import { NotificationSettingsProvider } from '../context/NotificationSettingsContext';

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function TestHarness({ children }: PropsWithChildren) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ServiceStatusProvider>
          <NotificationSettingsProvider>
            {children}
          </NotificationSettingsProvider>
        </ServiceStatusProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

export function withHarness(ui: React.ReactElement) {
  return <TestHarness>{ui}</TestHarness>;
}

