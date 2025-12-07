import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ThemeProvider } from '@/components/layout/theme-provider';

const createMatchMedia = (scheme: 'light' | 'dark') =>
  (query: string): MediaQueryList => ({
    matches: scheme === 'dark' && query.includes('prefers-color-scheme'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });

describe('Property 3: 主题切换一致性', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', createMatchMedia('light'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('用户切换主题时 data-theme 一致更新', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole('button', { name: '切换主题' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: '暗色模式' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: '亮色模式' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });
});

describe('Property 5: 系统主题检测', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal('matchMedia', createMatchMedia('dark'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('系统为暗色时默认采用 system -> dark', async () => {
    render(
      <ThemeProvider>
        <div>theme-consumer</div>
      </ThemeProvider>,
    );

    await waitFor(
      () => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      },
      { timeout: 2000 },
    );
  });
});

