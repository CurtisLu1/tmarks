'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = React.useMemo(() => getQueryClient(), []);

  return (
    <ThemeProvider>
      <Toaster>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </Toaster>
    </ThemeProvider>
  );
}

