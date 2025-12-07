'use client';

import React from 'react';

import { PublicAppShell } from '@/components/layout/PublicAppShell';

export default function PublicShareLayout({ children }: { children: React.ReactNode }) {
  return <PublicAppShell>{children}</PublicAppShell>;
}

