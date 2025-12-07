'use client';

import { useEffect, useState } from 'react';

import { BottomNav } from '@/components/common/BottomNav';
import { MobileHeader } from '@/components/common/MobileHeader';
import { TodoSidebar } from '@/components/tab-groups/TodoSidebar';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { logger } from '@/lib/logger';
import { tabGroupsService } from '@/services/tab-groups';
import type { TabGroup } from '@/lib/types';

export default function TodoPage() {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  const loadTabGroups = async () => {
    try {
      setLoading(true);
      const groups = await tabGroupsService.getAllTabGroups();
      setTabGroups(groups.filter((g) => !g.is_deleted));
    } catch (err) {
      logger.error('Failed to load tab groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTabGroups();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col bg-background ${isMobile ? 'overflow-hidden' : ''}`}>
      {isMobile && (
        <MobileHeader title="待办事项" showMenu={false} showSearch={false} showMore={false} />
      )}
      <div className={`flex-1 overflow-hidden ${isMobile ? 'min-h-0' : ''}`}>
        <TodoSidebar tabGroups={tabGroups} onUpdate={loadTabGroups} />
      </div>
      {isMobile && <BottomNav />}
    </div>
  );
}

