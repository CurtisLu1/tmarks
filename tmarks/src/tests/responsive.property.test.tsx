import React from 'react';
import { act, render, waitFor, cleanup } from '@testing-library/react';
import { assert, asyncProperty, integer } from 'fast-check';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { BatchActionBar } from '@/components/tab-groups/BatchActionBar';

type MediaChangeListener = (event: MediaQueryListEvent) => void;

interface MatchMediaController {
  (query: string): MediaQueryList;
  setWidth: (width: number) => void;
}

function parseQueryMatches(query: string, width: number): boolean {
  const minMatch = query.match(/min-width:\s*(\d+)px/);
  const maxMatch = query.match(/max-width:\s*(\d+)px/);
  const minWidth = minMatch ? Number(minMatch[1]) : null;
  const maxWidth = maxMatch ? Number(maxMatch[1]) : null;
  return (minWidth === null || width >= minWidth) && (maxWidth === null || width <= maxWidth);
}

function createMatchMediaController(initialWidth: number): MatchMediaController {
  let width = initialWidth;
  const subscribers: Array<{
    query: string;
    listeners: Set<MediaChangeListener>;
    mql: MediaQueryList;
  }> = [];

  const controller = ((query: string): MediaQueryList => {
    const listeners = new Set<MediaChangeListener>();
    const mediaQueryList: MediaQueryList = {
      media: query,
      matches: parseQueryMatches(query, width),
      onchange: null,
      addEventListener: (_event, listener) => listeners.add(listener),
      removeEventListener: (_event, listener) => listeners.delete(listener),
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
      dispatchEvent: (event) => {
        listeners.forEach((listener) => listener(event as MediaQueryListEvent));
        return true;
      },
    };

    subscribers.push({ query, listeners, mql: mediaQueryList });
    return mediaQueryList;
  }) as MatchMediaController;

  controller.setWidth = (nextWidth: number) => {
    width = nextWidth;
    subscribers.forEach(({ query, listeners, mql }) => {
      const nextMatches = parseQueryMatches(query, width);
      mql.matches = nextMatches;
      const event = { matches: nextMatches, media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
      if (mql.onchange) mql.onchange(event);
    });
  };

  return controller;
}

function createNoop() {
  return () => undefined;
}

describe('Property 7: 响应式布局', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('针对不同视口宽度切换移动/桌面布局', async () => {
    const noop = createNoop();

    await assert(
      asyncProperty(integer({ min: 360, max: 1440 }), async (width) => {
        const matchMedia = createMatchMediaController(width);
        vi.stubGlobal('matchMedia', matchMedia as unknown as typeof window.matchMedia);

        const { getByTestId, queryByText, unmount } = render(
          <BatchActionBar
            selectedCount={2}
            onSelectAll={noop}
            onDeselectAll={noop}
            onBatchDelete={noop}
            onBatchPin={noop}
            onBatchTodo={noop}
            onBatchExport={noop}
            onCancel={noop}
          />,
        );

        const isMobileWidth = width <= 767;

        await waitFor(() => {
          const container = getByTestId('batch-action-bar');
          if (isMobileWidth) {
            expect(container.className).toContain('fixed');
            expect(queryByText('固定')).toBeNull();
          } else {
            expect(container.className).toContain('p-4');
            expect(queryByText('固定')).not.toBeNull();
          }
        });

        const toggledWidth = isMobileWidth ? 1024 : 480;
        await act(async () => {
          matchMedia.setWidth(toggledWidth);
        });

        await waitFor(() => {
          const container = getByTestId('batch-action-bar');
          if (isMobileWidth) {
            expect(container.className).toContain('p-4');
            expect(queryByText('固定')).not.toBeNull();
          } else {
            expect(container.className).toContain('fixed');
            expect(queryByText('固定')).toBeNull();
          }
        });

        unmount();
      }),
      { numRuns: 20 },
    );
  });
});


