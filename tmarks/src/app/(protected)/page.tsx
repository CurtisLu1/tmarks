'use client';

import { CheckCircle } from 'lucide-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  parseAsArrayOf,
  parseAsString,
  useQueryStates,
} from 'nuqs';

import { BatchActionBar } from '@/components/bookmarks/BatchActionBar';
import { BookmarkForm } from '@/components/bookmarks/BookmarkForm';
import { BookmarkListContainer } from '@/components/bookmarks/BookmarkListContainer';
import { PaginationFooter } from '@/components/common/PaginationFooter';
import type { SortOption } from '@/components/common/SortSelector';
import { TagSidebar } from '@/components/tags/TagSidebar';
import { useInfiniteBookmarks } from '@/hooks/useBookmarks';
import { usePreferences, useUpdatePreferences } from '@/hooks/usePreferences';
import { useTags } from '@/hooks/useTags';
import type { Bookmark, BookmarkQueryParams } from '@/lib/types';

const VIEW_MODES = ['list', 'card', 'minimal', 'title'] as const;
type ViewMode = (typeof VIEW_MODES)[number];
type VisibilityFilter = 'all' | 'public' | 'private';

const VIEW_MODE_STORAGE_KEY = 'tmarks:view_mode';
const VIEW_MODE_UPDATED_AT_STORAGE_KEY = 'tmarks:view_mode_updated_at';
const SORT_OPTIONS: SortOption[] = ['created', 'updated', 'pinned', 'popular'];
const VISIBILITY_OPTIONS: VisibilityFilter[] = ['all', 'public', 'private'];

function isValidViewMode(value: string | null): value is ViewMode {
  return !!value && (VIEW_MODES as readonly string[]).includes(value);
}

function getStoredViewMode(): ViewMode | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return isValidViewMode(stored) ? stored : null;
}

function setStoredViewMode(mode: ViewMode, updatedAt?: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  window.localStorage.setItem(
    VIEW_MODE_UPDATED_AT_STORAGE_KEY,
    String(
      typeof updatedAt === 'number' && Number.isFinite(updatedAt)
        ? updatedAt
        : Date.now(),
    ),
  );
}

function createEnumParser<T extends string>(_values: readonly T[], fallback: T) {
  return parseAsString.withDefault(fallback);
}

export default function BookmarksPage() {
  const initialViewMode = useMemo<ViewMode>(
    () => getStoredViewMode() ?? 'card',
    [],
  );

  const [
    { keyword, view: viewRaw, sort: sortRaw, visibility: visibilityRaw, mode: modeRaw, tags },
    setQueryStates,
  ] = useQueryStates(
    {
      keyword: parseAsString.withDefault(''),
      view: createEnumParser(VIEW_MODES, initialViewMode),
      sort: createEnumParser(SORT_OPTIONS, 'popular'),
      visibility: createEnumParser(VISIBILITY_OPTIONS, 'all'),
      mode: createEnumParser(['bookmark', 'tag'] as const, 'bookmark'),
      tags: parseAsArrayOf(parseAsString).withDefault([]),
    },
    {
      clearOnDefault: true,
      history: 'replace',
    },
  );

  const view = viewRaw as ViewMode;
  const sort = sortRaw as SortOption;
  const visibility = visibilityRaw as VisibilityFilter;
  const mode = modeRaw as 'bookmark' | 'tag';

  const [debouncedSelectedTags, setDebouncedSelectedTags] = useState<string[]>(
    tags,
  );
  const [searchKeyword, setSearchKeyword] = useState(keyword);
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] =
    useState(keyword);
  const [tagLayout, setTagLayout] = useState<'grid' | 'masonry'>('grid');
  const [sortByInitialized, setSortByInitialized] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isTagSidebarOpen, setIsTagSidebarOpen] = useState(false);
  const [preferencesApplied, setPreferencesApplied] = useState(false);
  const previousCountRef = useRef(0);
  const autoCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  // 同步 URL state 与本地 state
  useEffect(() => {
    setSearchKeyword(keyword);
  }, [keyword]);

  useEffect(() => {
    setDebouncedSelectedTags(tags);
  }, [tags]);

  // 标签选择防抖：延迟 300ms 更新实际标签筛选
  const debouncedUpdateTags = useCallback((next: string[]) => {
    if (tagDebounceTimerRef.current) {
      clearTimeout(tagDebounceTimerRef.current);
    }
    tagDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSelectedTags(next);
    }, 300);
  }, []);

  useEffect(() => {
    debouncedUpdateTags(tags);
    return () => {
      if (tagDebounceTimerRef.current) {
        clearTimeout(tagDebounceTimerRef.current);
      }
    };
  }, [debouncedUpdateTags, tags]);

  // 搜索防抖：延迟 500ms 更新实际搜索关键词
  const debouncedUpdateSearch = useCallback((keywordValue: string) => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(keywordValue);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cleanup = debouncedUpdateSearch(searchKeyword);
    return cleanup;
  }, [debouncedUpdateSearch, searchKeyword]);

  // 从偏好设置同步视图/排序/布局
  useEffect(() => {
    if (!preferences || preferencesApplied) return;

    if (preferences.view_mode && preferences.view_mode !== view) {
      setQueryStates({ view: preferences.view_mode }, { history: 'replace' });
      setStoredViewMode(
        preferences.view_mode,
        preferences.updated_at ? new Date(preferences.updated_at).getTime() : undefined,
      );
    }

    if (preferences.sort_by && !sortByInitialized) {
      setQueryStates(
        { sort: preferences.sort_by },
        { history: 'replace' },
      );
      setSortByInitialized(true);
    }

    if (preferences.tag_layout) {
      setTagLayout(preferences.tag_layout);
    }

    setPreferencesApplied(true);
  }, [
    preferences,
    preferencesApplied,
    setQueryStates,
    sortByInitialized,
    view,
  ]);

  // 自动清除标签选择
  useEffect(() => {
    if (autoCleanupTimerRef.current) {
      clearTimeout(autoCleanupTimerRef.current);
    }

    const enableAutoClear = preferences?.enable_tag_selection_auto_clear ?? false;
    const clearSeconds = preferences?.tag_selection_auto_clear_seconds ?? 30;

    if (enableAutoClear && tags.length > 0) {
      autoCleanupTimerRef.current = setTimeout(() => {
        setQueryStates({ tags: [] });
      }, clearSeconds * 1000);
    }

    return () => {
      if (autoCleanupTimerRef.current) {
        clearTimeout(autoCleanupTimerRef.current);
      }
    };
  }, [
    preferences?.enable_tag_selection_auto_clear,
    preferences?.tag_selection_auto_clear_seconds,
    setQueryStates,
    tags,
  ]);

  // 自动清除搜索关键词
  useEffect(() => {
    if (searchCleanupTimerRef.current) {
      clearTimeout(searchCleanupTimerRef.current);
    }

    const enableAutoClear = preferences?.enable_search_auto_clear ?? true;
    const clearSeconds = preferences?.search_auto_clear_seconds ?? 15;

    if (enableAutoClear && searchKeyword.trim()) {
      searchCleanupTimerRef.current = setTimeout(() => {
        setQueryStates({ keyword: '' });
        setSearchKeyword('');
        setDebouncedSearchKeyword('');
      }, clearSeconds * 1000);
    }

    return () => {
      if (searchCleanupTimerRef.current) {
        clearTimeout(searchCleanupTimerRef.current);
      }
    };
  }, [
    preferences?.enable_search_auto_clear,
    preferences?.search_auto_clear_seconds,
    searchKeyword,
    setQueryStates,
  ]);

  const queryParams = useMemo<BookmarkQueryParams>(() => {
    const params: BookmarkQueryParams = {};
    if (mode === 'bookmark' && debouncedSearchKeyword.trim()) {
      params.keyword = debouncedSearchKeyword.trim();
    }
    if (debouncedSelectedTags.length > 0) {
      params.tags = debouncedSelectedTags.join(',');
    }
    params.sort = sort as SortOption;
    return params;
  }, [debouncedSearchKeyword, debouncedSelectedTags, mode, sort]);

  const bookmarksQuery = useInfiniteBookmarks(queryParams);
  const { refetch: refetchTags } = useTags();

  const bookmarks = useMemo(() => {
    if (!bookmarksQuery.data?.pages?.length) return [] as Bookmark[];
    const allBookmarks = bookmarksQuery.data.pages.flatMap((page) => page.bookmarks);
    const uniqueMap = new Map<string, Bookmark>();
    allBookmarks.forEach((item) => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });
    return Array.from(uniqueMap.values());
  }, [bookmarksQuery.data]);

  const filteredBookmarks = useMemo(() => {
    if (visibility === 'all') return bookmarks;
    return bookmarks.filter((item) =>
      visibility === 'public' ? item.is_public : !item.is_public,
    );
  }, [bookmarks, visibility]);

  const isInitialLoading = bookmarksQuery.isLoading && bookmarks.length === 0;
  const isFetchingExisting = bookmarksQuery.isFetching && !isInitialLoading;

  useEffect(() => {
    if (filteredBookmarks.length > 0) {
      previousCountRef.current = filteredBookmarks.length;
    }
  }, [filteredBookmarks.length]);

  const hasMore = Boolean(bookmarksQuery.hasNextPage);

  const handleOpenForm = useCallback((bookmark?: Bookmark) => {
    setEditingBookmark(bookmark ?? null);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingBookmark(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    bookmarksQuery.refetch();
    refetchTags();
  }, [bookmarksQuery, refetchTags]);

  const handleLoadMore = useCallback(() => {
    if (bookmarksQuery.hasNextPage) {
      bookmarksQuery.fetchNextPage();
    }
  }, [bookmarksQuery]);

  const handleViewModeChange = useCallback(() => {
    const currentIndex = VIEW_MODES.indexOf(view);
    const nextIndex = (currentIndex + 1) % VIEW_MODES.length;
    const nextMode = VIEW_MODES[nextIndex]!;
    setQueryStates({ view: nextMode });
    setStoredViewMode(nextMode);
    updatePreferences.mutate({ view_mode: nextMode });
  }, [setQueryStates, updatePreferences, view]);

  const handleTagLayoutChange = useCallback(
    (layout: 'grid' | 'masonry') => {
      setTagLayout(layout);
      updatePreferences.mutate({ tag_layout: layout });
    },
    [updatePreferences],
  );

  const handleSortByChange = useCallback(() => {
    const currentIndex = SORT_OPTIONS.indexOf(sort);
    const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
    const nextSort = SORT_OPTIONS[nextIndex]!;
    setQueryStates({ sort: nextSort });
    updatePreferences.mutate({ sort_by: nextSort });
  }, [setQueryStates, sort, updatePreferences]);

  const handleToggleSelect = useCallback((bookmarkId: string) => {
    setSelectedIds((prev) =>
      prev.includes(bookmarkId)
        ? prev.filter((id) => id !== bookmarkId)
        : [...prev, bookmarkId],
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(filteredBookmarks.map((b) => b.id));
  }, [filteredBookmarks]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    setBatchMode(false);
  }, []);

  const handleBatchSuccess = useCallback(() => {
    setSelectedIds([]);
    setBatchMode(false);
    bookmarksQuery.refetch();
    refetchTags();
  }, [bookmarksQuery, refetchTags]);

  const getViewModeLabel = (mode: ViewMode) => {
    switch (mode) {
      case 'list':
        return '列表视图';
      case 'card':
        return '卡片视图';
      case 'minimal':
        return '极简列表';
      case 'title':
        return '标题瀑布';
    }
  };

  const visibilityFilter: VisibilityFilter = visibility;
  const searchMode = mode;
  const selectedTags = tags;

  return (
    <div className="w-full h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] flex flex-col overflow-hidden touch-pan-y">
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 w-full h-full overflow-hidden touch-pan-y">
        {/* 左侧：标签侧边栏 - 桌面端显示 */}
        <aside className="hidden lg:flex flex-shrink-0 w-72 xl:w-80 2xl:w-96 order-2 lg:order-1 flex-col overflow-hidden">
          <TagSidebar
            selectedTags={selectedTags}
            onTagsChange={(next) => setQueryStates({ tags: next })}
            tagLayout={tagLayout}
            onTagLayoutChange={handleTagLayoutChange}
            bookmarks={filteredBookmarks}
            isLoadingBookmarks={isInitialLoading || isFetchingExisting}
            searchQuery={searchMode === 'tag' ? debouncedSearchKeyword : ''}
          />
        </aside>

        {/* 右侧：书签列表 */}
        <main className="flex-1 order-1 lg:order-2 flex flex-col h-full overflow-hidden w-full min-w-0">
          {/* 顶部操作栏 */}
          <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4 w-full">
            <div className="card shadow-float w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
                <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:min-w-[280px]">
                  <button
                    onClick={() => setIsTagSidebarOpen(true)}
                    className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-card border border-border hover:bg-muted hover:border-primary/30 text-foreground"
                    title="打开标签"
                    aria-label="打开标签"
                    type="button"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </button>

                  {/* 搜索框 */}
                  <div className="flex-1 min-w-0">
                    <div className="relative w-full">
                      <button
                        onClick={() =>
                          setQueryStates({
                            mode: searchMode === 'bookmark' ? 'tag' : 'bookmark',
                          })
                        }
                        className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center transition-all hover:text-primary"
                        title={
                          searchMode === 'bookmark'
                            ? '切换到标签搜索'
                            : '切换到书签搜索'
                        }
                        aria-label={
                          searchMode === 'bookmark'
                            ? '切换到标签搜索'
                            : '切换到书签搜索'
                        }
                        type="button"
                      >
                        {searchMode === 'bookmark' ? (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                            />
                          </svg>
                        )}
                      </button>

                      <svg
                        className="absolute left-10 sm:left-12 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>

                      <input
                        type="text"
                        className="input w-full !pl-16 sm:!pl-[4.5rem] h-11 sm:h-auto text-sm sm:text-base"
                        placeholder={
                          searchMode === 'bookmark' ? '搜索书签...' : '搜索标签...'
                        }
                        value={searchKeyword}
                        onChange={(e) => {
                          setSearchKeyword(e.target.value);
                          setQueryStates({ keyword: e.target.value });
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={handleSortByChange}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-muted text-foreground hover:bg-muted/80 touch-manipulation flex-shrink-0"
                      title="切换排序"
                      aria-label="切换排序"
                      type="button"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        const nextFilter =
                          visibilityFilter === 'all'
                            ? 'public'
                            : visibilityFilter === 'public'
                              ? 'private'
                              : 'all';
                        setQueryStates({ visibility: nextFilter });
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float touch-manipulation flex-shrink-0 ${visibilityFilter === 'all'
                        ? 'bg-muted text-foreground hover:bg-muted/80'
                        : visibilityFilter === 'public'
                          ? 'bg-success/10 text-success hover:bg-success/20'
                          : 'bg-warning/10 text-warning hover:bg-warning/20'
                        }`}
                      title="切换可见性"
                      aria-label="切换可见性"
                      type="button"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 6h16M4 12h16M4 18h16"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={handleViewModeChange}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-muted text-foreground hover:bg-muted/80 touch-manipulation flex-shrink-0"
                      title={`${getViewModeLabel(view)} (点击切换)`}
                      aria-label={`${getViewModeLabel(view)} (点击切换)`}
                      type="button"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 4h18l-7 8v6l-4 2v-8L3 4z"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => {
                        setBatchMode(!batchMode);
                        if (batchMode) {
                          setSelectedIds([]);
                        }
                      }}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float touch-manipulation flex-shrink-0 ${batchMode
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-muted/80'
                        }`}
                      title={batchMode ? '退出批量操作' : '批量操作'}
                      aria-label={batchMode ? '退出批量操作' : '批量操作'}
                      type="button"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleOpenForm()}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-all active:scale-95 touch-manipulation flex-shrink-0"
                      title="新增书签"
                      aria-label="新增书签"
                      type="button"
                    >
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {batchMode && (
              <div className="card bg-primary/10 border border-primary/20 mt-3 sm:mt-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {selectedIds.length > 0
                        ? `已选择 ${selectedIds.length} 个`
                        : '请选择书签'}
                    </span>
                    {selectedIds.length < filteredBookmarks.length && (
                      <>
                        <span className="text-border hidden sm:inline">|</span>
                        <button
                          onClick={handleSelectAll}
                          className="text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                          type="button"
                        >
                          全选 ({filteredBookmarks.length})
                        </button>
                      </>
                    )}
                    {selectedIds.length > 0 && (
                      <>
                        <span className="text-border hidden sm:inline">|</span>
                        <button
                          onClick={handleClearSelection}
                          className="text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                          type="button"
                        >
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-6 pb-20 sm:pb-4 md:pb-6 w-full overscroll-contain touch-auto">
            <div className="space-y-3 sm:space-y-4 md:space-y-5 w-full min-w-0">
              <BookmarkListContainer
                bookmarks={filteredBookmarks}
                isLoading={isInitialLoading || isFetchingExisting}
                viewMode={view}
                onEdit={handleOpenForm}
                previousCount={previousCountRef.current}
                batchMode={batchMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />

              {!isInitialLoading && filteredBookmarks.length > 0 && (
                <PaginationFooter
                  hasMore={hasMore}
                  isLoading={bookmarksQuery.isFetchingNextPage}
                  onLoadMore={handleLoadMore}
                  currentCount={filteredBookmarks.length}
                  totalLoaded={filteredBookmarks.length}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {isTagSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsTagSidebarOpen(false)}
          />

          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-r border-border shadow-xl animate-in slide-in-from-left duration-300 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background flex-shrink-0">
              <h3 className="text-lg font-semibold text-foreground">标签筛选</h3>
              <button
                onClick={() => setIsTagSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="关闭标签抽屉"
                type="button"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background min-h-0 overscroll-contain touch-auto">
              <TagSidebar
                selectedTags={selectedTags}
                onTagsChange={(next) => {
                  setQueryStates({ tags: next });
                  if (next.length >= 2 && next.length > selectedTags.length) {
                    setTimeout(() => setIsTagSidebarOpen(false), 500);
                  }
                }}
                tagLayout={tagLayout}
                onTagLayoutChange={handleTagLayoutChange}
                bookmarks={filteredBookmarks}
                isLoadingBookmarks={isInitialLoading || isFetchingExisting}
                searchQuery={searchMode === 'tag' ? debouncedSearchKeyword : ''}
              />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <BookmarkForm
          bookmark={editingBookmark}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {batchMode && selectedIds.length > 0 && (
        <BatchActionBar
          selectedIds={selectedIds}
          onClearSelection={handleClearSelection}
          onSuccess={handleBatchSuccess}
        />
      )}
    </div>
  );
}

