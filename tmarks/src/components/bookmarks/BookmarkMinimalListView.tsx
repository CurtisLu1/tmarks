import type { Bookmark } from '@/lib/types'
import { useRecordClick } from '@/hooks/useBookmarks'

interface BookmarkMinimalListViewProps {
  bookmarks: Bookmark[]
  onEdit?: (bookmark: Bookmark) => void
  readOnly?: boolean
  batchMode?: boolean
  selectedIds?: string[]
  onToggleSelect?: (id: string) => void
}

export function BookmarkMinimalListView({
  bookmarks,
  onEdit,
  readOnly = false,
  batchMode = false,
  selectedIds = [],
  onToggleSelect,
}: BookmarkMinimalListViewProps) {
  return (
    <div className="rounded-xl border border-base-300 overflow-hidden overflow-x-auto">
      {/* 表头 - 移动端只显示标题和操作 */}
      <div className={`grid ${batchMode ? 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto]' : 'grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto]'} gap-2 sm:gap-4 px-3 sm:px-4 py-2 text-xs uppercase tracking-wide text-base-content/50 bg-base-200`}>
        {batchMode && <span></span>}
        <span>标题</span>
        <span className="hidden sm:block">网址</span>
        <span className="hidden sm:block">备注</span>
        <span className="text-right sm:block">{readOnly ? '' : ''}</span>
      </div>
      <div>
        {bookmarks.map((bookmark) => (
          <MinimalRow
            key={bookmark.id}
            bookmark={bookmark}
            onEdit={onEdit ? () => onEdit(bookmark) : undefined}
            readOnly={readOnly}
            batchMode={batchMode}
            isSelected={selectedIds.includes(bookmark.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  )
}

interface MinimalRowProps {
  bookmark: Bookmark
  onEdit?: () => void
  readOnly?: boolean
  batchMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

function MinimalRow({
  bookmark,
  onEdit,
  readOnly = false,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
}: MinimalRowProps) {
  const recordClick = useRecordClick()

  const handleVisit = () => {
    if (!readOnly) {
      recordClick.mutate(bookmark.id)
    }
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={`grid ${batchMode ? 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto]' : 'grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_auto]'} gap-2 sm:gap-4 px-3 sm:px-4 py-3 text-sm items-center border-t border-base-200 first:border-t-0 hover:bg-base-200/60 ${
      batchMode && isSelected ? 'bg-primary/10' : ''
    }`}>
      {batchMode && onToggleSelect && (
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleSelect(bookmark.id)
            }}
            className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border-2 border-border hover:border-primary'
            }`}
            title={isSelected ? '取消选择' : '选择'}
          >
            {isSelected && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>
      )}
      
      {/* 标题 */}
      <button
        type="button"
        onClick={handleVisit}
        className="text-left font-medium text-sm sm:text-base truncate hover:text-primary min-w-0"
        title={bookmark.title}
      >
        {bookmark.title || bookmark.url}
      </button>
      
      {/* 网址 - 移动端隐藏 */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:block text-xs text-primary truncate hover:underline min-w-0"
        title={bookmark.url}
      >
        {bookmark.url}
      </a>
      
      {/* 备注 - 移动端隐藏 */}
      <span className="hidden sm:block text-xs text-base-content/70 truncate min-w-0" title={bookmark.description || undefined}>
        {bookmark.description || '—'}
      </span>
      
      {/* 操作按钮 */}
      <div className="flex justify-end items-center">
        {!!onEdit && !readOnly && !batchMode ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onEdit()
            }}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-base-300 transition-colors text-base-content/70 hover:text-base-content"
            title="编辑"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
