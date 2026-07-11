import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithAuth } from '../../api';
import PricingValidationCard from '../PricingValidationCard';

vi.mock('../../api', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('PricingValidationCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records plan interest without representing it as a purchase', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response('{}', { status: 202 }));
    render(<PricingValidationCard />);

    expect(screen.getByText(/will not create a subscription or charge/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /growth/i }));
    fireEvent.click(screen.getByRole('button', { name: /record my preference/i }));

    await waitFor(() =>
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/api/product-validation/interest',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            plan: 'growth',
            source: 'homepage-pricing-validation',
            monitoredListingsBand: '101-500',
          }),
        }),
      ),
    );
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument();
  });
});
