import { useMutation, useQuery } from '@tanstack/react-query';
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import {
  marketIntelligenceAPI,
  type CompetitorData,
  type LimitsResponse,
} from '../api/marketIntelligence';
import {
  addCompetitorIntelligent,
  deleteCompetitor,
  getSuggestionCount,
  refreshSuggestionCount,
} from '../api';

export const queryKeys = {
  competitors: ['competitors'] as const,
  suggestionCount: ['suggestion-count'] as const,
  limits: ['mi-limits'] as const,
};

export function useCompetitors(options?: UseQueryOptions<CompetitorData[]>) {
  return useQuery({
    queryKey: queryKeys.competitors,
    queryFn: () => marketIntelligenceAPI.getCompetitors(),
    staleTime: 30_000,
    ...options,
  });
}

export function useMiLimits(options?: UseQueryOptions<LimitsResponse>) {
  return useQuery({
    queryKey: queryKeys.limits,
    queryFn: () => marketIntelligenceAPI.checkLimits(),
    staleTime: 60_000,
    ...options,
  });
}

export function useSuggestionCount(options?: UseQueryOptions<{ newSuggestions: number }>) {
  return useQuery({
    queryKey: queryKeys.suggestionCount,
    queryFn: () => getSuggestionCount(),
    staleTime: 15_000,
    ...options,
  });
}

export function useRefreshSuggestionCount() {
  return useMutation({
    mutationFn: () => refreshSuggestionCount(),
  });
}

export interface AddCompetitorInput {
  url: string;
  productId?: string;
}

export function useAddCompetitor(options?: UseMutationOptions<any, Error, AddCompetitorInput>) {
  return useMutation<any, Error, AddCompetitorInput>({
    mutationFn: ({ url, productId }) => addCompetitorIntelligent(url, productId),
    ...options,
  });
}

export function useDeleteCompetitor(options?: UseMutationOptions<void, Error, string>) {
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteCompetitor(id),
    ...options,
  });
}
