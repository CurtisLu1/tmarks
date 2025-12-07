import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { assert, asyncProperty, boolean, constantFrom, integer, record } from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';

import { usePreferences, useUpdatePreferences } from '@/hooks/usePreferences';
import type { UpdatePreferencesRequest, UserPreferences } from '@/lib/types';
import { preferencesService } from '@/services/preferences';

vi.mock('@/services/preferences', () => {
  let preferencesState: UserPreferences = createBasePreferences();

  return {
    preferencesService: {
      getPreferences: vi.fn(async () => preferencesState),
      updatePreferences: vi.fn(async (data: UpdatePreferencesRequest) => {
        preferencesState = {
          ...preferencesState,
          ...data,
          updated_at: new Date().toISOString(),
        };
        return preferencesState;
      }),
    },
    __setPreferencesState: (next: UserPreferences) => {
      preferencesState = next;
    },
  };
});

const preferencesMock = preferencesService as typeof preferencesService & {
  __setPreferencesState?: (prefs: UserPreferences) => void;
};

const preferenceUpdateArb = record({
  theme: constantFrom('light', 'dark', 'system'),
  page_size: integer({ min: 10, max: 200 }),
  view_mode: constantFrom('list', 'card', 'minimal', 'title'),
  density: constantFrom('compact', 'normal', 'comfortable'),
  tag_layout: constantFrom('grid', 'masonry'),
  sort_by: constantFrom('created', 'updated', 'pinned', 'popular'),
  search_auto_clear_seconds: integer({ min: 0, max: 120 }),
  tag_selection_auto_clear_seconds: integer({ min: 0, max: 120 }),
  enable_search_auto_clear: boolean(),
  enable_tag_selection_auto_clear: boolean(),
  default_bookmark_icon: constantFrom('orbital-spinner'),
  snapshot_retention_count: integer({ min: 0, max: 50 }),
  snapshot_auto_create: boolean(),
  snapshot_auto_dedupe: boolean(),
  snapshot_auto_cleanup_days: integer({ min: 0, max: 365 }),
});

describe('Property 10: 设置持久化', () => {
  beforeEach(() => {
    preferencesMock.__setPreferencesState?.(createBasePreferences());
    vi.clearAllMocks();
  });

  it('更新后重新获取偏好保持最新值', async () => {
    await assert(
      asyncProperty(preferenceUpdateArb, async (update) => {
        const client = createQueryClient();
        const wrapper = ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );

        const preferencesHook = renderHook(() => usePreferences(), { wrapper });
        await waitFor(() => expect(preferencesHook.result.current.data).toBeDefined());

        const mutationHook = renderHook(() => useUpdatePreferences(), { wrapper });
        await act(async () => {
          await mutationHook.result.current.mutateAsync(update);
        });

        client.clear();
        client.cancelQueries();

        const refreshedClient = createQueryClient();
        const refreshedWrapper = ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={refreshedClient}>{children}</QueryClientProvider>
        );

        const refreshedHook = renderHook(() => usePreferences(), { wrapper: refreshedWrapper });
        await waitFor(() => expect(refreshedHook.result.current.data).toBeDefined());

        const persisted = refreshedHook.result.current.data!;
        Object.entries(update).forEach(([key, value]) => {
          expect((persisted as Record<string, unknown>)[key]).toEqual(value);
        });

        client.clear();
        refreshedClient.clear();
      }),
      { numRuns: 10 },
    );
  });
});

function createBasePreferences(): UserPreferences {
  return {
    user_id: 'user-1',
    theme: 'light',
    page_size: 30,
    view_mode: 'list',
    density: 'normal',
    tag_layout: 'grid',
    sort_by: 'popular',
    search_auto_clear_seconds: 15,
    tag_selection_auto_clear_seconds: 30,
    enable_search_auto_clear: true,
    enable_tag_selection_auto_clear: false,
    default_bookmark_icon: 'orbital-spinner',
    snapshot_retention_count: 5,
    snapshot_auto_create: false,
    snapshot_auto_dedupe: true,
    snapshot_auto_cleanup_days: 0,
    updated_at: new Date().toISOString(),
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

