import { QueryClient } from '@tanstack/react-query';

/**
 * Shared React Query client. Analytics queries use long staleTime and no
 * refetch-on-focus to avoid hammering Mongo-backed aggregations.
 *
 * Baseline: compare Network request counts in a production build vs dev
 * (React StrictMode double-invokes effects in development only).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
