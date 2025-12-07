import type { Bookmark } from '@/lib/types'
import { BookmarkListView } from './BookmarkListView'
import { BookmarkCardView } from './BookmarkCardView'
import { BookmarkMinimalListView } from './BookmarkMinimalListView'
import { BookmarkTitleView } from './BookmarkTitleView'

interface BookmarkListContainerProps {
  bookmarks: Bookmark[]
  isLoading?: boolean
  viewMode?: 'list' | 'card' | 'minimal' | 'title'
  onEdit?: (bookmark: Bookmark) => void
  readOnly?: boolean
  previousCount?: number
  batchMode?: boolean
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
}

export function BookmarkListContainer({
  bookmarks,
  isLoading,
  viewMode = 'list',
  onEdit,
  readOnly = false,
  previousCount = 0,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: BookmarkListContainerProps) {

  if (isLoading && bookmarks.length === 0) {
    // 使用上次的书签数量，如果没有则默认显示3个
    const skeletonCount = previousCount > 0 ? Math.min(previousCount, 10) : 3

    return (
      <div className="space-y-4">
        {[...Array(skeletonCount)].map((_, i) => (
          <div key={i} className="card animate-pulse shadow-float">
            <div className="h-32 bg-gradient-to-r from-base-300 via-base-200 to-base-300 rounded-xl"></div>
          </div>
        ))}
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="card text-center py-16 shadow-float">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20 mb-6 mx-auto">
          <svg className="w-16 h-16 text-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          暂无书签
        </h3>
        <p className="text-base-content/60 text-base">
          {readOnly ? '发布者尚未公开任何书签，或公开内容已取消' : '点击右上角 "新增书签" 按钮开始收藏精彩内容'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* 加载指示器 */}
      {isLoading && bookmarks.length > 0 && (
        <div className="mb-4 flex items-center justify-center gap-2 text-sm text-primary">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>加载中...</span>
        </div>
      )}

      {/* 书签列表/卡片 */}
      {viewMode === 'list' ? (
        <BookmarkListView
          bookmarks={bookmarks}
          onEdit={onEdit}
          readOnly={readOnly}
          batchMode={batchMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ) : viewMode === 'minimal' ? (
        <BookmarkMinimalListView
          bookmarks={bookmarks}
          onEdit={onEdit}
          readOnly={readOnly}
          batchMode={batchMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ) : viewMode === 'title' ? (
        <BookmarkTitleView
          bookmarks={bookmarks}
          onEdit={onEdit}
          readOnly={readOnly}
          batchMode={batchMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ) : (
        <BookmarkCardView
          bookmarks={bookmarks}
          onEdit={onEdit}
          readOnly={readOnly}
          batchMode={batchMode}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      )}
    </>
  )
}
