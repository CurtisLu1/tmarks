'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { BookmarkListContainer } from '@/components/bookmarks/BookmarkListContainer';
import { PaginationFooter } from '@/components/common/PaginationFooter';
import { TagSidebar } from '@/components/tags/TagSidebar';
import type { SortOption } from '@/components/common/SortSelector';
import { usePublicShare } from '@/hooks/useShare';
import type { Bookmark, Tag } from '@/lib/types';

const VIEW_MODES = ['list', 'card', 'minimal', 'title'] as const;
type ViewMode = (typeof VIEW_MODES)[number];
type VisibilityFilter = 'all' | 'public' | 'private';

const SORT_OPTIONS: SortOption[] = ['created', 'updated', 'pinned', 'popular'];

const VISIBILITY_LABELS: Record<VisibilityFilter, string> = {
  all: '全部书签',
  public: '仅公开',
  private: '仅私密',
};

const SORT_LABELS: Record<SortOption, string> = {
  created: '按创建时间',
  updated: '按更新时间',
  pinned: '置顶优先',
  popular: '按热门程度',
};

const PAGE_SIZE = 30;

function ViewModeIcon({ mode }: { mode: ViewMode }) {
  if (mode === 'card') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z" />
      </svg>
    );
  }
  if (mode === 'minimal') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 5.5v13M17 5.5v13" />
      </svg>
    );
  }
  if (mode === 'title') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h8M4 12h12M4 18h10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5v2M18 11v2M16 17v2" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
    </svg>
  );
}

function VisibilityIcon({ filter }: { filter: VisibilityFilter }) {
  if (filter === 'public') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (filter === 'private') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="4" y="10" width="16" height="10" rx="2" ry="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 118 0v3" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function SortIcon({ sort }: { sort: SortOption }) {
  if (sort === 'created') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    );
  }
  if (sort === 'updated') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  }
  if (sort === 'pinned') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

interface SharePageClientProps {
  slug: string | null;
}

export default function PublicSharePage({ slug: initialSlug }: SharePageClientProps) {
  const [slug, setSlug] = useState(initialSlug ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [debouncedSelectedTags, setDebouncedSelectedTags] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
  const [searchMode, setSearchMode] = useState<'bookmark' | 'tag'>('bookmark');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [tagLayout, setTagLayout] = useState<'grid' | 'masonry'>('grid');
  const [isTagSidebarOpen, setIsTagSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tagSortBy, setTagSortBy] = useState<'usage' | 'name' | 'clicks'>('usage');

  const tagDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSlug(initialSlug ?? '');
  }, [initialSlug]);

  const shareQuery = usePublicShare(slug, Boolean(slug));
  const allBookmarks = useMemo(() => shareQuery.data?.bookmarks || [], [shareQuery.data?.bookmarks]);

  useEffect(() => {
    if (tagDebounceTimerRef.current) clearTimeout(tagDebounceTimerRef.current);
    tagDebounceTimerRef.current = setTimeout(() => {
      setDebouncedSelectedTags(selectedTags);
    }, 300);
    return () => {
      if (tagDebounceTimerRef.current) clearTimeout(tagDebounceTimerRef.current);
    };
  }, [selectedTags]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchKeyword(searchKeyword), 500);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const visibilityFilteredBookmarks = useMemo(() => {
    if (visibilityFilter === 'all') return allBookmarks;
    if (visibilityFilter === 'public') return allBookmarks.filter((bookmark: Bookmark) => bookmark.is_public);
    return allBookmarks.filter((bookmark: Bookmark) => !bookmark.is_public);
  }, [allBookmarks, visibilityFilter]);

  const tagFilteredBookmarks = useMemo(() => {
    if (selectedTags.length === 0) return visibilityFilteredBookmarks;
    return visibilityFilteredBookmarks.filter((bookmark: Bookmark) => {
      const bookmarkTagIds = bookmark.tags?.map((t: Tag) => t.id) || [];
      return selectedTags.every((tagId) => bookmarkTagIds.includes(tagId));
    });
  }, [visibilityFilteredBookmarks, selectedTags]);

  const allFilteredBookmarks = useMemo(() => {
    const byVisibility = visibilityFilteredBookmarks;
    const byTags = debouncedSelectedTags.length
      ? byVisibility.filter((bookmark: Bookmark) => {
          const bookmarkTagIds = bookmark.tags?.map((t: Tag) => t.id) || [];
          return debouncedSelectedTags.every((tagId) => bookmarkTagIds.includes(tagId));
        })
      : byVisibility;

    const byKeyword =
      searchMode === 'bookmark' && debouncedSearchKeyword.trim()
        ? byTags.filter((bookmark: Bookmark) => {
            const keyword = debouncedSearchKeyword.trim().toLowerCase();
            return (
              bookmark.title.toLowerCase().includes(keyword) ||
              (bookmark.description || '').toLowerCase().includes(keyword) ||
              bookmark.url.toLowerCase().includes(keyword)
            );
          })
        : byTags;

    const sorted = [...byKeyword].sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'pinned':
          if (a.is_pinned !== b.is_pinned) {
            return Number(b.is_pinned) - Number(a.is_pinned);
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'popular':
          if ((b.click_count || 0) !== (a.click_count || 0)) {
            return (b.click_count || 0) - (a.click_count || 0);
          }
          if (b.last_clicked_at && a.last_clicked_at) {
            return new Date(b.last_clicked_at).getTime() - new Date(a.last_clicked_at).getTime();
          }
          return 0;
        case 'created':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return sorted;
  }, [visibilityFilteredBookmarks, debouncedSelectedTags, debouncedSearchKeyword, sortBy, searchMode]);

  const displayedBookmarks = useMemo(
    () => allFilteredBookmarks.slice(0, currentPage * PAGE_SIZE),
    [allFilteredBookmarks, currentPage],
  );

  const hasMore = displayedBookmarks.length < allFilteredBookmarks.length;
  const currentPageCount = Math.min(PAGE_SIZE, Math.max(allFilteredBookmarks.length - (currentPage - 1) * PAGE_SIZE, 0));
  const shareInfo = shareQuery.data?.profile;

  const tags = useMemo(() => {
    const rawTags = shareQuery.data?.tags || [];
    const tagsCopy = [...rawTags];
    if (tagSortBy === 'name') {
      return tagsCopy.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    return tagsCopy.sort((a, b) => (b.bookmark_count || 0) - (a.bookmark_count || 0));
  }, [shareQuery.data?.tags, tagSortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSelectedTags, debouncedSearchKeyword, sortBy, visibilityFilter]);

  useEffect(() => {
    if (autoCleanupTimerRef.current) clearTimeout(autoCleanupTimerRef.current);
    if (selectedTags.length > 0) {
      autoCleanupTimerRef.current = setTimeout(() => setSelectedTags([]), 30000);
    }
    return () => {
      if (autoCleanupTimerRef.current) clearTimeout(autoCleanupTimerRef.current);
    };
  }, [selectedTags]);

  useEffect(() => {
    if (searchCleanupTimerRef.current) clearTimeout(searchCleanupTimerRef.current);
    if (searchKeyword.trim()) {
      searchCleanupTimerRef.current = setTimeout(() => setSearchKeyword(''), 15000);
    }
    return () => {
      if (searchCleanupTimerRef.current) clearTimeout(searchCleanupTimerRef.current);
    };
  }, [searchKeyword]);

  const handleViewModeChange = useCallback(() => {
    const currentIndex = VIEW_MODES.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % VIEW_MODES.length;
    setViewMode(VIEW_MODES[nextIndex]!);
  }, [viewMode]);

  const handleVisibilityChange = useCallback(() => {
    const nextFilter =
      visibilityFilter === 'all'
        ? 'public'
        : visibilityFilter === 'public'
          ? 'private'
          : 'all';
    setVisibilityFilter(nextFilter);
  }, [visibilityFilter]);

  const handleSortByChange = useCallback(() => {
    const currentIndex = SORT_OPTIONS.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % SORT_OPTIONS.length;
    setSortBy(SORT_OPTIONS[nextIndex]!);
  }, [sortBy]);

  const handleLoadMore = () => setCurrentPage((prev) => prev + 1);

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

  return (
    <div className="w-full mx-auto py-3 sm:py-4 md:py-6 px-3 sm:px-4 md:px-6">
      {shareQuery.isLoading && <div className="text-center text-muted-foreground py-24">正在加载公开书签...</div>}
      {shareQuery.isError && !shareQuery.isLoading && (
        <div className="text-center text-muted-foreground py-24">分享链接无效或内容已下线。</div>
      )}

      {!shareQuery.isLoading && !shareQuery.isError && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6">
          <aside className="hidden lg:block lg:col-span-3 order-2 lg:order-1 fixed top-[calc(5rem+0.75rem)] sm:top-[calc(5rem+1rem)] md:top-[calc(5rem+1.5rem)] left-3 sm:left-4 md:left-6 bottom-3 w-[calc(25%-1.5rem)] z-40">
            <TagSidebar
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              bookmarks={tagFilteredBookmarks}
              isLoadingBookmarks={shareQuery.isLoading}
              tagLayout={tagLayout}
              onTagLayoutChange={setTagLayout}
              readOnly
              availableTags={tags}
              tagSortBy={tagSortBy}
              onTagSortChange={setTagSortBy}
              searchQuery={searchMode === 'tag' ? debouncedSearchKeyword : ''}
            />
          </aside>

          <main className="lg:col-span-9 lg:col-start-4 order-1 lg:order-2">
            <div className="space-y-3 sm:space-y-4 md:space-y-5">
              <div className="card shadow-float">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h1 className="text-xl sm:text-2xl font-bold text-primary">
                      {shareInfo?.title || `${shareInfo?.username || '访客'}的书签精选`}
                    </h1>
                    {shareInfo?.description && (
                      <p className="text-sm text-muted-foreground mt-1">{shareInfo.description}</p>
                    )}
                  </div>
                  {allBookmarks.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {allFilteredBookmarks.length === allBookmarks.length ? (
                        <span>共 {allBookmarks.length} 个书签</span>
                      ) : (
                        <span>
                          筛选出 {allFilteredBookmarks.length} / {allBookmarks.length} 个书签
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="card shadow-float">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 flex-1 w-full sm:min-w-[280px]">
                    <button
                      onClick={() => setIsTagSidebarOpen(true)}
                      className="lg:hidden w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-card border border-border hover:bg-muted hover:border-primary/30 text-foreground"
                      title="打开标签"
                      aria-label="打开标签"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="relative w-full">
                        <button
                          onClick={() => setSearchMode(searchMode === 'bookmark' ? 'tag' : 'bookmark')}
                          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center transition-all hover:text-primary"
                          title={searchMode === 'bookmark' ? '切换到标签搜索' : '切换到书签搜索'}
                          aria-label={searchMode === 'bookmark' ? '切换到标签搜索' : '切换到书签搜索'}
                          type="button"
                        >
                          {searchMode === 'bookmark' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          )}
                        </button>

                        <svg
                          className="absolute left-10 sm:left-12 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground pointer-events-none"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>

                        <input
                          type="text"
                          className="input w-full !pl-16 sm:!pl-[4.5rem] h-11 sm:h-auto text-sm sm:text-base"
                          placeholder={searchMode === 'bookmark' ? '搜索书签...' : '搜索标签...'}
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleSortByChange}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-muted text-foreground hover:bg-muted/80 touch-manipulation flex-shrink-0"
                      title={`${SORT_LABELS[sortBy]} (点击切换)`}
                      aria-label={`${SORT_LABELS[sortBy]} (点击切换)`}
                      type="button"
                    >
                      <SortIcon sort={sortBy} />
                    </button>

                    <button
                      onClick={handleVisibilityChange}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float touch-manipulation flex-shrink-0 ${
                        visibilityFilter === 'all'
                          ? 'bg-muted text-foreground hover:bg-muted/80'
                          : visibilityFilter === 'public'
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-warning/10 text-warning hover:bg-warning/20'
                      }`}
                      title={`${VISIBILITY_LABELS[visibilityFilter]} (点击切换)`}
                      aria-label={`${VISIBILITY_LABELS[visibilityFilter]} (点击切换)`}
                      type="button"
                    >
                      <VisibilityIcon filter={visibilityFilter} />
                    </button>

                    <button
                      onClick={handleViewModeChange}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shadow-float bg-muted text-foreground hover:bg-muted/80 touch-manipulation flex-shrink-0"
                      title={`${getViewModeLabel(viewMode)} (点击切换)`}
                      aria-label={`${getViewModeLabel(viewMode)} (点击切换)`}
                      type="button"
                    >
                      <ViewModeIcon mode={viewMode} />
                    </button>
                  </div>
                </div>
              </div>

              {displayedBookmarks.length > 0 ? (
                <>
                  <BookmarkListContainer bookmarks={displayedBookmarks} viewMode={viewMode} readOnly />
                  <PaginationFooter
                    hasMore={hasMore}
                    isLoading={false}
                    onLoadMore={handleLoadMore}
                    currentCount={currentPageCount}
                    totalLoaded={displayedBookmarks.length}
                  />
                </>
              ) : (
                !shareQuery.isLoading &&
                allBookmarks.length > 0 && (
                  <div className="card text-center py-12">
                    <div className="text-muted-foreground mb-2">
                      <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-lg font-medium">没有找到匹配的书签</p>
                      <p className="text-sm mt-2">尝试调整筛选条件或搜索关键词</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </main>
        </div>
      )}

      {isTagSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsTagSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-background border-r border-border shadow-xl animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border bg-background">
              <h3 className="text-lg font-semibold text-foreground">标签筛选</h3>
              <button
                onClick={() => setIsTagSidebarOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="关闭标签抽屉"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-background">
              <TagSidebar
                selectedTags={selectedTags}
                onTagsChange={(newTags) => {
                  setSelectedTags(newTags);
                  if (newTags.length >= 2 && newTags.length > selectedTags.length) {
                    setTimeout(() => setIsTagSidebarOpen(false), 500);
                  }
                }}
                tagLayout={tagLayout}
                onTagLayoutChange={setTagLayout}
                bookmarks={tagFilteredBookmarks}
                isLoadingBookmarks={shareQuery.isLoading}
                readOnly
                availableTags={tags}
                tagSortBy={tagSortBy}
                onTagSortChange={setTagSortBy}
                searchQuery={searchMode === 'tag' ? debouncedSearchKeyword : ''}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

