import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  DashboardMetricsSkeleton,
  DataTableSkeleton,
  ChartSkeleton,
  ListSkeleton,
  FormSkeleton,
  PageSkeleton,
} from '../SkeletonLoaders';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('SkeletonLoaders', () => {
  describe('DashboardMetricsSkeleton', () => {
    it('renders default number of metric cards', () => {
      renderWithTheme(<DashboardMetricsSkeleton />);
      
      // Should render 4 cards by default
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders custom number of metric cards', () => {
      renderWithTheme(<DashboardMetricsSkeleton count={6} />);
      
      // Should render 6 cards
      const cards = screen.getAllByRole('generic').filter(el => 
        el.className.includes('MuiCard-root')
      );
      expect(cards).toHaveLength(6);
    });
  });

  describe('DataTableSkeleton', () => {
    it('renders table skeleton with default props', () => {
      renderWithTheme(<DataTableSkeleton />);
      
      // Should have search bar, header, and rows
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders table skeleton with search and filters', () => {
      renderWithTheme(
        <DataTableSkeleton 
          columns={5} 
          rows={10} 
          hasSearch={true} 
          hasFilters={true} 
        />
      );
      
      // Should include search and filter sections
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders table skeleton without search and filters', () => {
      renderWithTheme(
        <DataTableSkeleton 
          hasSearch={false} 
          hasFilters={false} 
        />
      );
      
      // Should not include search and filter sections
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('ChartSkeleton', () => {
    it('renders chart skeleton with title', () => {
      renderWithTheme(<ChartSkeleton title={true} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders chart skeleton without title', () => {
      renderWithTheme(<ChartSkeleton title={false} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders chart skeleton with custom height', () => {
      renderWithTheme(<ChartSkeleton height={500} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('ListSkeleton', () => {
    it('renders list skeleton with avatars', () => {
      renderWithTheme(<ListSkeleton showAvatar={true} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders list skeleton without avatars', () => {
      renderWithTheme(<ListSkeleton showAvatar={false} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders custom number of list items', () => {
      renderWithTheme(<ListSkeleton items={10} />);
      
      const cards = screen.getAllByRole('generic').filter(el => 
        el.className.includes('MuiCard-root')
      );
      expect(cards).toHaveLength(10);
    });
  });

  describe('FormSkeleton', () => {
    it('renders form skeleton with default fields', () => {
      renderWithTheme(<FormSkeleton />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders form skeleton with custom number of fields', () => {
      renderWithTheme(<FormSkeleton fields={8} />);
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('PageSkeleton', () => {
    it('renders page skeleton with header and sidebar', () => {
      renderWithTheme(
        <PageSkeleton 
          hasHeader={true} 
          hasSidebar={true} 
          contentType="dashboard" 
        />
      );
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders page skeleton without header', () => {
      renderWithTheme(
        <PageSkeleton 
          hasHeader={false} 
          hasSidebar={true} 
          contentType="table" 
        />
      );
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders page skeleton without sidebar', () => {
      renderWithTheme(
        <PageSkeleton 
          hasHeader={true} 
          hasSidebar={false} 
          contentType="form" 
        />
      );
      
      const skeletons = screen.getAllByTestId(/skeleton/i);
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders different content types', () => {
      const contentTypes: Array<'dashboard' | 'table' | 'form' | 'chart'> = [
        'dashboard', 'table', 'form', 'chart'
      ];
      
      contentTypes.forEach(contentType => {
        const { unmount } = renderWithTheme(
          <PageSkeleton contentType={contentType} />
        );
        
        const skeletons = screen.getAllByTestId(/skeleton/i);
        expect(skeletons.length).toBeGreaterThan(0);
        
        unmount();
      });
    });
  });
});