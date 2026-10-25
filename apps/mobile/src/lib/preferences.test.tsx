import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ThemeProvider, useTheme } from '@/theme/theme-provider';

import { getPreferences, patchPreferences } from './api';
import { useUpdatePreferences } from './preferences';

jest.mock('./api', () => ({
  getPreferences: jest.fn(),
  patchPreferences: jest.fn(),
}));
jest.mock('./auth-client', () => ({
  useSession: jest.fn(() => ({ data: { user: { id: 'u1' } } })),
}));

const mockGet = getPreferences as jest.Mock;
const mockPatch = patchPreferences as jest.Mock;

let queryClient: QueryClient;

function renderUpdate() {
  // gcTime: Infinity schedules no cache timers, which would otherwise hold jest
  // open for their five minutes after the last test.
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return renderHook(() => ({ update: useUpdatePreferences(), theme: useTheme() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider initialTheme="cocoa-plum" initialMode="light">
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    ),
  });
}

afterEach(() => {
  queryClient.clear();
  jest.clearAllMocks();
});

describe('useUpdatePreferences', () => {
  it('applies a change before the server answers', async () => {
    // Never settles, so anything on screen came from the optimistic half.
    mockPatch.mockReturnValue(new Promise(() => {}));
    const { result } = await renderUpdate();

    await act(() => result.current.update.mutate({ theme: 'warm-ink' }));

    await waitFor(() => expect(result.current.theme.theme).toBe('warm-ink'));
    expect(result.current.theme.mode).toBe('light');
    expect(mockPatch).toHaveBeenCalledWith({ theme: 'warm-ink' }, expect.anything());
  });

  it('puts the old appearance back when the server refuses', async () => {
    mockPatch.mockRejectedValue(new Error('PATCH /api/preferences failed: 500'));
    mockGet.mockResolvedValue({ theme: 'cocoa-plum', mode: 'light' });
    const { result } = await renderUpdate();

    await act(() => result.current.update.mutate({ mode: 'dark' }));

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(result.current.theme.mode).toBe('light');
    expect(result.current.theme.theme).toBe('cocoa-plum');
  });
});
