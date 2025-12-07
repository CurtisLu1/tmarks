import type { Metadata } from 'next';
import React from 'react';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TMarks',
  description: 'AI 驱动的智能书签管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

