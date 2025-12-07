'use client';

import {
  ArrowLeft,
  Calendar,
  Check,
  Edit2,
  ExternalLink,
  Layers,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { logger } from '@/lib/logger';
import { tabGroupsService } from '@/services/tab-groups';
import { useToastStore } from '@/stores/toastStore';
import type { TabGroup } from '@/lib/types';

interface TabGroupDetailClientProps {
  tabGroupId: string | null;
}

export default function TabGroupDetailClient({ tabGroupId }: TabGroupDetailClientProps) {
  const router = useRouter();
  const { success, error: showError } = useToastStore();

  const [tabGroup, setTabGroup] = useState<TabGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const safeTitle = useMemo(() => tabGroup?.title ?? '', [tabGroup?.title]);

  const loadTabGroup = useCallback(
    async (groupId: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const group = await tabGroupsService.getTabGroup(groupId);
        setTabGroup(group);
        setEditedTitle(group.title);
      } catch (err) {
        logger.error('Failed to load tab group:', err);
        setError('加载标签页组失败');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tabGroupId && tabGroupId !== 'placeholder') {
      loadTabGroup(tabGroupId);
    } else {
      setError('未找到标签页组');
      setIsLoading(false);
    }
  }, [loadTabGroup, tabGroupId]);

  const handleSaveTitle = async () => {
    if (!tabGroup || !editedTitle.trim()) return;
    try {
      setIsSavingTitle(true);
      const updated = await tabGroupsService.updateTabGroup(tabGroup.id, {
        title: editedTitle.trim(),
      });
      setTabGroup(updated);
      setIsEditingTitle(false);
      success('标题更新成功');
    } catch (err) {
      logger.error('Failed to update title:', err);
      showError('更新标题失败，请重试');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedTitle(tabGroup?.title || '');
    setIsEditingTitle(false);
  };

  const handleDelete = () => {
    if (!tabGroup) return;
    setConfirmDialog({
      isOpen: true,
      title: '删除标签页组',
      message: `确定要删除标签页组“${safeTitle}”吗？此操作不可撤销。`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await tabGroupsService.deleteTabGroup(tabGroup.id);
          success('删除成功');
          router.push('/tab');
        } catch (err) {
          logger.error('Failed to delete tab group:', err);
          showError('删除失败，请重试');
        }
      },
    });
  };

  const handleRestoreAll = () => {
    if (!tabGroup?.items?.length) return;
    const items = tabGroup.items;
    const itemCount = items.length;
    const message =
      itemCount > 10
        ? `即将打开 ${itemCount} 个标签页，将分批打开以避免浏览器拦截。\n\n每批 10 个，间隔 1 秒。\n\n是否继续？`
        : `确定要在新标签页中打开 ${itemCount} 个链接吗？`;

    setConfirmDialog({
      isOpen: true,
      title: '打开所有标签页',
      message,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        const BATCH_SIZE = 10;
        const BATCH_DELAY = 1000;
        const totalBatches = Math.ceil(itemCount / BATCH_SIZE);

        for (let i = 0; i < itemCount; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
          if (totalBatches > 1) {
            success(`正在打开第 ${currentBatch}/${totalBatches} 批...`);
          }
          batch.forEach((item, index) => {
            setTimeout(() => {
              window.open(item.url, '_blank', 'noopener,noreferrer');
            }, index * 100);
          });
          if (i + BATCH_SIZE < itemCount) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
          }
        }
        success(`已成功打开 ${itemCount} 个标签页！`);
      },
    });
  };

  const handleOpenTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !tabGroup) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || '标签页组不存在'}</p>
          <button
            onClick={() => router.push('/tab')}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-foreground"
            type="button"
          >
            返回列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => router.push('/tab')}
          className="flex items-center gap-2 mb-4 text-sm hover:opacity-70 transition-opacity text-muted-foreground"
          type="button"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <button
                  onClick={handleSaveTitle}
                  disabled={isSavingTitle || !editedTitle.trim()}
                  className="p-2 rounded-lg bg-success text-success-foreground hover:bg-success/90 transition-colors disabled:opacity-50"
                  type="button"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSavingTitle}
                  className="p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-foreground">{safeTitle}</h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                  title="编辑标题"
                  type="button"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(tabGroup.created_at)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" />
                <span>{tabGroup.items?.length || 0} 个标签页</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/50 transition-colors flex items-center gap-2"
              title="删除标签页组"
              type="button"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">删除</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {tabGroup.items && tabGroup.items.length > 0 ? (
          <>
            <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-foreground" />
                  <span className="font-medium text-foreground">共 {tabGroup.items.length} 个标签页</span>
                </div>
                <button
                  onClick={handleRestoreAll}
                  className="px-3 py-1.5 rounded-lg bg-success text-success-foreground text-sm font-medium hover:shadow-lg hover:bg-success/90 transition-all duration-200 flex items-center gap-1.5"
                  type="button"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  全部恢复
                </button>
              </div>
            </div>

            {tabGroup.items.map((item, index) => (
              <div
                key={item.id}
                className="group relative flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-success/50 hover:shadow-md transition-all duration-200 cursor-pointer"
                onClick={() => handleOpenTab(item.url)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenTab(item.url);
                  }
                }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-success/20 to-success/10 flex-shrink-0">
                  <span className="text-sm font-semibold text-foreground">{index + 1}</span>
                </div>

                {item.favicon && (
                  <img src={item.favicon} alt="" className="w-5 h-5 rounded flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate mb-0.5 text-foreground">{item.title}</h3>
                  <p className="text-sm truncate text-muted-foreground">{item.url}</p>
                </div>

                <ExternalLink className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground" />
              </div>
            ))}
          </>
        ) : (
          <div className="text-center py-12 rounded-2xl border border-border bg-card">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <ExternalLink className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1 text-foreground">此标签页组没有标签页</p>
            <p className="text-sm text-muted-foreground">标签页组已被清空</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

