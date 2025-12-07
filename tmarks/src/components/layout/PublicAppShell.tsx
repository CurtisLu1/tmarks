'use client';

import { BookOpen, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import React from 'react';

import { ColorThemeSelector } from '@/components/common/ColorThemeSelector';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useThemeStore } from '@/stores/themeStore';

interface PublicAppShellProps {
  children: React.ReactNode;
}

export function PublicAppShell({ children }: PublicAppShellProps) {
  const { colorTheme } = useThemeStore();
  const { resolvedTheme, theme } = useTheme();
  const router = useRouter();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--background)' }}
      data-theme={resolvedTheme ?? theme ?? 'light'}
      data-color-theme={colorTheme}
    >
      <header className="h-16 sm:h-20 sticky top-0 z-50 backdrop-filter backdrop-blur-xl bg-card/80 border-b border-border/50 shadow-float flex items-center">
        <div className="w-full mx-auto px-3 sm:px-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity duration-200 focus:outline-none"
            title="回到首页"
            type="button"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-float">
              <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: 'var(--foreground)' }} />
            </div>
            <div className="block text-left">
              <h1 className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                TMarks
              </h1>
              <p className="text-xs font-medium hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
                智能书签管理
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            <ThemeToggle />
            <ColorThemeSelector />

            <a
              href="/tmarks-extension.zip"
              download="tmarks-extension.zip"
              className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border border-border hover:border-primary hover:bg-card/50 text-foreground"
              title="下载浏览器插件"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">插件</span>
            </a>

            <button
              onClick={() => router.push('/login')}
              className="px-3 py-2 sm:px-4 sm:py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-primary text-primary-content hover:bg-primary/90 shadow-float"
              type="button"
            >
              登录
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-3 sm:px-6">
        <div className="mx-auto" style={{ maxWidth: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
