'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { Route } from 'next';
import React from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/authStore';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const loginHref: Route = pathname
        ? (`/login?next=${encodeURIComponent(pathname)}` as Route)
        : '/login';
      router.replace(loginHref);
      return;
    }
    setChecking(false);
  }, [isAuthenticated, isLoading, pathname, router]);

  if (checking || isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">正在检查登录状态…</p>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export default ProtectedLayout;

