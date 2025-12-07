'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { BottomNav } from '@/components/common/BottomNav';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Drawer } from '@/components/common/Drawer';
import { MobileHeader } from '@/components/common/MobileHeader';
import { ResizablePanel } from '@/components/common/ResizablePanel';
import { BatchActionBar } from '@/components/tab-groups/BatchActionBar';
import { EmptyState } from '@/components/tab-groups/EmptyState';
import { MoveItemDialog } from '@/components/tab-groups/MoveItemDialog';
import { SearchBar } from '@/components/tab-groups/SearchBar';
import { ShareDialog } from '@/components/tab-groups/ShareDialog';
import { TabGroupHeader } from '@/components/tab-groups/TabGroupHeader';
import { TabGroupTree } from '@/components/tab-groups/TabGroupTree';
import { TabItemList } from '@/components/tab-groups/TabItemList';
import { TodoSidebar } from '@/components/tab-groups/TodoSidebar';
import type { SortOption } from '@/components/tab-groups/sortUtils';
import { sortTabGroups } from '@/components/tab-groups/sortUtils';
import { useBatchActions } from '@/hooks/useBatchActions';
import { useIsDesktop, useIsMobile } from '@/hooks/useMediaQuery';
import { usePreferences } from '@/hooks/usePreferences';
import { useTabGroupActions } from '@/hooks/useTabGroupActions';
import { searchInFields } from '@/lib/search-utils';
import { tabGroupsService } from '@/services/tab-groups';
import type { TabGroup, TabGroupItem } from '@/lib/types';
import { logger } from '@/lib/logger';

export default function TabGroupsPage() {
  const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [highlightedDomain, setHighlightedDomain] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('created');
  const [sharingGroupId, setSharingGroupId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const searchCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [moveItemDialog, setMoveItemDialog] = useState<{
    isOpen: boolean;
    item: TabGroupItem | null;
    currentGroupId: string;
  }>({
    isOpen: false,
    item: null,
    currentGroupId: '',
  });

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

  const {
    editingItemId,
    setEditingItemId,
    editingTitle,
    setEditingTitle,
    editingGroupId,
    setEditingGroupId,
    editingGroupTitle,
    setEditingGroupTitle,
    handleDelete,
    handleOpenAll,
    handleExportMarkdown,
    handleEditGroup,
    handleSaveGroupEdit,
    handleEditItem,
    handleSaveEdit,
    handleTogglePin,
    handleToggleTodo,
    handleDeleteItem,
  } = useTabGroupActions({
    setTabGroups,
    setDeletingId,
    setConfirmDialog,
    confirmDialog,
  });

  const {
    handleBatchDelete,
    handleBatchPin,
    handleBatchTodo,
    handleBatchExport,
    handleDeselectAll,
  } = useBatchActions({
    tabGroups,
    setTabGroups,
    selectedItems,
    setSelectedItems,
    setConfirmDialog,
    confirmDialog,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    loadTabGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: preferences } = usePreferences();

  useEffect(() => {
    if (searchCleanupTimerRef.current) {
      clearTimeout(searchCleanupTimerRef.current);
      searchCleanupTimerRef.current = null;
    }
    const enableAutoClear = preferences?.enable_search_auto_clear ?? true;
    const clearSeconds = preferences?.search_auto_clear_seconds ?? 15;
    if (enableAutoClear && searchQuery.trim()) {
      searchCleanupTimerRef.current = setTimeout(() => {
        setSearchQuery('');
        setDebouncedSearchQuery('');
      }, clearSeconds * 1000);
    }
    return () => {
      if (searchCleanupTimerRef.current) {
        clearTimeout(searchCleanupTimerRef.current);
        searchCleanupTimerRef.current = null;
      }
    };
  }, [searchQuery, preferences?.enable_search_auto_clear, preferences?.search_auto_clear_seconds]);

  const loadTabGroups = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const groups = await tabGroupsService.getAllTabGroups();
      logger.log('[TabGroupsPage] Loaded groups:', groups.length);
      setTabGroups(groups);
    } catch (err) {
      logger.error('Failed to load tab groups:', err);
      setError('加载标签页组失败');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTreeOnly = async () => {
    try {
      const groups = await tabGroupsService.getAllTabGroups();
      setTabGroups(groups);
    } catch (err) {
      logger.error('Failed to refresh tree:', err);
      setError('刷新失败');
    }
  };

  const handleCreateFolder = async () => {
    try {
      await tabGroupsService.createFolder('新文件夹');
      await refreshTreeOnly();
    } catch (err) {
      logger.error('Failed to create folder:', err);
      setError('创建文件夹失败');
    }
  };

  const handleRenameGroup = async (groupId: string, newTitle: string) => {
    try {
      await tabGroupsService.updateTabGroup(groupId, { title: newTitle });
      await refreshTreeOnly();
    } catch (err) {
      logger.error('Failed to rename group:', err);
      setError('重命名失败');
    }
  };

  const handleMoveGroup = async (groupId: string, newParentId: string | null, newPosition: number) => {
    try {
      const draggedGroup = tabGroups.find((g) => g.id === groupId);
      if (!draggedGroup) return;
      const siblings = tabGroups
        .filter((g) => (g.parent_id || null) === newParentId)
        .sort((a, b) => (a.position || 0) - (b.position || 0));
      const draggedIndex = siblings.findIndex((g) => g.id === groupId);
      if (draggedIndex !== -1) siblings.splice(draggedIndex, 1);
      siblings.splice(newPosition, 0, draggedGroup);
      const updates = siblings.map((g, index) => ({
        id: g.id,
        position: index,
        parent_id: newParentId,
      }));
      await Promise.all(
        updates.map((update) =>
          tabGroupsService.updateTabGroup(update.id, {
            position: update.position,
            parent_id: update.parent_id,
          }),
        ),
      );
      await refreshTreeOnly();
    } catch (err) {
      logger.error('Failed to move group:', err);
      setError('移动失败');
    }
  };

  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  };

  const handleItemClick = (item: TabGroupItem, e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    if (batchMode) {
      e.preventDefault();
      const next = new Set(selectedItems);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      setSelectedItems(next);
      return;
    }
    const domain = extractDomain(item.url);
    setHighlightedDomain((prev) => (prev === domain ? null : domain));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    let sourceGroup: TabGroup | undefined;
    let sourceItem: TabGroupItem | undefined;
    let targetGroup: TabGroup | undefined;
    let targetItem: TabGroupItem | undefined;

    for (const group of tabGroups) {
      const item = group.items?.find((i) => i.id === active.id);
      if (item) {
        sourceGroup = group;
        sourceItem = item;
        break;
      }
    }
    for (const group of tabGroups) {
      const item = group.items?.find((i) => i.id === over.id);
      if (item) {
        targetGroup = group;
        targetItem = item;
        break;
      }
    }
    if (!sourceGroup || !sourceItem || !targetGroup || !targetItem) return;

    if (sourceGroup.id === targetGroup.id) {
      const oldIndex = sourceGroup.items!.findIndex((item) => item.id === active.id);
      const newIndex = sourceGroup.items!.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(sourceGroup.items!, oldIndex, newIndex);
      setTabGroups((prev) =>
        prev.map((g) => (g.id === sourceGroup!.id ? { ...g, items: newItems } : g)),
      );
      try {
        await Promise.all(
          newItems.map((item, index) => tabGroupsService.updateTabGroupItem(item.id, { position: index })),
        );
      } catch (err) {
        logger.error('Failed to update positions:', err);
        setTabGroups((prev) =>
          prev.map((g) => (g.id === sourceGroup!.id ? { ...g, items: sourceGroup!.items } : g)),
        );
      }
    } else {
      const targetIndex = targetGroup.items!.findIndex((item) => item.id === over.id);
      const newSourceItems = sourceGroup.items!.filter((item) => item.id !== active.id);
      const newTargetItems = [...targetGroup.items!];
      newTargetItems.splice(targetIndex, 0, sourceItem);
      setTabGroups((prev) =>
        prev.map((g) => {
          if (g.id === sourceGroup!.id) {
            return { ...g, items: newSourceItems, item_count: newSourceItems.length };
          }
          if (g.id === targetGroup!.id) {
            return { ...g, items: newTargetItems, item_count: newTargetItems.length };
          }
          return g;
        }),
      );
      try {
        await tabGroupsService.moveTabGroupItem(sourceItem.id, targetGroup.id, targetIndex);
        await Promise.all(
          newSourceItems.map((item, index) =>
            tabGroupsService.updateTabGroupItem(item.id, { position: index }),
          ),
        );
      } catch (err) {
        logger.error('Failed to move item across groups:', err);
        setTabGroups((prev) =>
          prev.map((g) => {
            if (g.id === sourceGroup!.id) {
              return { ...g, items: sourceGroup!.items, item_count: sourceGroup!.items!.length };
            }
            if (g.id === targetGroup!.id) {
              return { ...g, items: targetGroup!.items, item_count: targetGroup!.items!.length };
            }
            return g;
          }),
        );
      }
    }
  };

  const handleMoveItem = (item: TabGroupItem) => {
    const currentGroup = tabGroups.find((g) => g.items?.some((i) => i.id === item.id));
    if (currentGroup) {
      setMoveItemDialog({ isOpen: true, item, currentGroupId: currentGroup.id });
    }
  };

  const handleMoveItemToGroup = async (targetGroupId: string) => {
    const { item, currentGroupId } = moveItemDialog;
    if (!item) return;
    const sourceGroup = tabGroups.find((g) => g.id === currentGroupId);
    const targetGroup = tabGroups.find((g) => g.id === targetGroupId);
    if (!sourceGroup || !targetGroup) return;

    const newSourceItems = sourceGroup.items!.filter((i) => i.id !== item.id);
    const newTargetItems = [...(targetGroup.items || []), item];

    setTabGroups((prev) =>
      prev.map((g) => {
        if (g.id === currentGroupId) {
          return { ...g, items: newSourceItems, item_count: newSourceItems.length };
        }
        if (g.id === targetGroupId) {
          return { ...g, items: newTargetItems, item_count: newTargetItems.length };
        }
        return g;
      }),
    );

    try {
      await tabGroupsService.moveTabGroupItem(item.id, targetGroupId, newTargetItems.length - 1);
      await Promise.all(
        newSourceItems.map((i, index) => tabGroupsService.updateTabGroupItem(i.id, { position: index })),
      );
    } catch (err) {
      logger.error('Failed to move item to group:', err);
      setTabGroups((prev) =>
        prev.map((g) => {
          if (g.id === currentGroupId) {
            return { ...g, items: sourceGroup.items, item_count: sourceGroup.items!.length };
          }
          if (g.id === targetGroupId) {
            return { ...g, items: targetGroup.items, item_count: targetGroup.items?.length || 0 };
          }
          return g;
        }),
      );
    }
  };

  const groupFilteredTabGroups = useMemo(() => {
    if (!tabGroups.length) return [];
    if (!selectedGroupId) return tabGroups;
    const selectedGroup = tabGroups.find((g) => g.id === selectedGroupId);
    if (!selectedGroup) return [];
    if (selectedGroup.is_folder === 1) {
      const children = tabGroups.filter((g) => g.parent_id === selectedGroupId);
      return [selectedGroup, ...children];
    }
    return [selectedGroup];
  }, [selectedGroupId, tabGroups]);

  const filteredTabGroups = useMemo(() => {
    if (!groupFilteredTabGroups.length) return [];
    if (!debouncedSearchQuery.trim()) return groupFilteredTabGroups;
    const query = debouncedSearchQuery;
    const results: TabGroup[] = [];
    for (const group of groupFilteredTabGroups) {
      const matchesTitle = searchInFields([group.title], query);
      if (matchesTitle) {
        results.push(group);
      } else if (group.items?.length) {
        const filteredItems = group.items.filter((item) =>
          searchInFields([item.title, item.url], query),
        );
        if (filteredItems.length > 0) {
          results.push({ ...group, items: filteredItems });
        }
      }
    }
    return results;
  }, [groupFilteredTabGroups, debouncedSearchQuery]);

  const sortedGroups = useMemo(() => {
    if (!filteredTabGroups.length) return [];
    return sortTabGroups(filteredTabGroups, sortBy);
  }, [filteredTabGroups, sortBy]);

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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={loadTabGroups}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-foreground"
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] flex flex-col overflow-hidden touch-pan-y">
      <div className={`flex ${isMobile ? 'flex-col' : ''} w-full h-full overflow-hidden touch-pan-y`}>
        {isMobile && (
          <MobileHeader title="标签页组" onMenuClick={() => setIsDrawerOpen(true)} showSearch={false} showMore={false} />
        )}

        {isDesktop ? (
          <ResizablePanel side="left" defaultWidth={240} minWidth={200} maxWidth={400} storageKey="tab-groups-left-sidebar-width">
            <TabGroupTree
              tabGroups={tabGroups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onCreateFolder={handleCreateFolder}
              onRenameGroup={handleRenameGroup}
              onMoveGroup={handleMoveGroup}
              onRefresh={refreshTreeOnly}
            />
          </ResizablePanel>
        ) : (
          <Drawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            title="标签页组"
            side="left"
          >
            <TabGroupTree
              tabGroups={tabGroups}
              selectedGroupId={selectedGroupId}
              onSelectGroup={(id) => {
                setSelectedGroupId(id);
                setIsDrawerOpen(false);
              }}
              onCreateFolder={handleCreateFolder}
              onRenameGroup={handleRenameGroup}
              onMoveGroup={handleMoveGroup}
              onRefresh={refreshTreeOnly}
            />
          </Drawer>
        )}

        <div className={`flex-1 overflow-y-auto bg-muted/30 ${isMobile ? 'min-h-0' : ''}`}>
          <div className={`w-full px-4 ${isMobile ? 'py-4 pb-20' : 'py-6'}`}>
            <div className="mb-6">
              {tabGroups.length > 0 && (
                <div className="flex items-center gap-4 w-full">
                  {!isMobile && (
                    <h1 className="text-xl font-semibold text-foreground whitespace-nowrap flex-shrink-0">标签页组</h1>
                  )}
                  <SearchBar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onBatchModeToggle={() => setBatchMode(!batchMode)}
                    batchMode={batchMode}
                  />
                </div>
              )}

              {batchMode && selectedItems.size > 0 && (
                <div className="mt-4">
                  <BatchActionBar
                    selectedCount={selectedItems.size}
                    onSelectAll={() => {
                      const all = new Set<string>();
                      tabGroups.forEach((group) => group.items?.forEach((item) => all.add(item.id)));
                      setSelectedItems(all);
                    }}
                    onDeselectAll={handleDeselectAll}
                    onBatchDelete={handleBatchDelete}
                    onBatchPin={handleBatchPin}
                    onBatchTodo={handleBatchTodo}
                    onBatchExport={handleBatchExport}
                    onCancel={() => {
                      setBatchMode(false);
                      setSelectedItems(new Set());
                    }}
                  />
                </div>
              )}
            </div>

            {tabGroups.length === 0 && <EmptyState isSearching={false} searchQuery="" />}
            {tabGroups.length > 0 && filteredTabGroups.length === 0 && (
              <EmptyState isSearching searchQuery={searchQuery} />
            )}

            {sortedGroups.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 gap-6">
                  {sortedGroups.map((group) => (
                    <div
                      key={group.id}
                      className="card border-l-[3px] border-l-primary p-6 hover:shadow-xl transition-all duration-200"
                    >
                      <TabGroupHeader
                        group={group}
                        isEditingTitle={editingGroupId === group.id}
                        editingTitle={editingGroupTitle}
                        onEditTitle={() => handleEditGroup(group)}
                        onSaveTitle={() => handleSaveGroupEdit(group.id)}
                        onCancelEdit={() => {
                          setEditingGroupId(null);
                          setEditingGroupTitle('');
                        }}
                        onTitleChange={setEditingGroupTitle}
                        onOpenAll={() => handleOpenAll(group.items || [])}
                        onExport={() => handleExportMarkdown(group)}
                        onDelete={() => handleDelete(group.id, group.title)}
                        isDeleting={deletingId === group.id}
                        onShareClick={() => setSharingGroupId(group.id)}
                      />

                      {group.items && group.items.length > 0 && (
                        <TabItemList
                          items={group.items}
                          groupId={group.id}
                          highlightedDomain={highlightedDomain}
                          selectedItems={selectedItems}
                          batchMode={batchMode}
                          editingItemId={editingItemId}
                          editingTitle={editingTitle}
                          onItemClick={handleItemClick}
                          onEditItem={handleEditItem}
                          onSaveEdit={handleSaveEdit}
                          onTogglePin={handleTogglePin}
                          onToggleTodo={handleToggleTodo}
                          onDeleteItem={handleDeleteItem}
                          onMoveItem={handleMoveItem}
                          setEditingItemId={setEditingItemId}
                          setEditingTitle={setEditingTitle}
                          extractDomain={extractDomain}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </DndContext>
            )}

            {sharingGroupId && (
              <ShareDialog
                groupId={sharingGroupId}
                groupTitle={tabGroups.find((g) => g.id === sharingGroupId)?.title || ''}
                onClose={() => setSharingGroupId(null)}
              />
            )}

            <MoveItemDialog
              isOpen={moveItemDialog.isOpen}
              itemTitle={moveItemDialog.item?.title || ''}
              currentGroupId={moveItemDialog.currentGroupId}
              availableGroups={tabGroups}
              onMove={handleMoveItemToGroup}
              onClose={() => setMoveItemDialog({ isOpen: false, item: null, currentGroupId: '' })}
            />

            <ConfirmDialog
              isOpen={confirmDialog.isOpen}
              title={confirmDialog.title}
              message={confirmDialog.message}
              onConfirm={confirmDialog.onConfirm}
              onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
            />
          </div>
        </div>

        {isDesktop && (
          <ResizablePanel
            side="right"
            defaultWidth={320}
            minWidth={280}
            maxWidth={500}
            storageKey="tab-groups-right-sidebar-width"
          >
            <TodoSidebar tabGroups={tabGroups} onUpdate={loadTabGroups} />
          </ResizablePanel>
        )}

        {isMobile && <BottomNav />}
      </div>
    </div>
  );
}

