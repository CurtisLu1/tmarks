interface PaginationFooterProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  currentCount: number
  totalLoaded: number
}

export function PaginationFooter({
  hasMore,
  isLoading,
  onLoadMore,
  currentCount,
  totalLoaded,
}: PaginationFooterProps) {
  if (!hasMore && currentCount === 0) {
    return null
  }

  return (
    <div className="card text-center py-6 mt-6">
      {/* 统计信息 */}
      <div className="text-sm text-base-content/60 mb-4">
        {hasMore ? (
          <>已加载 {totalLoaded} 个书签</>
        ) : (
          <>共 {totalLoaded} 个书签</>
        )}
      </div>

      {/* 加载更多按钮 */}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              加载中...
            </>
          ) : (
            '加载更多'
          )}
        </button>
      )}

      {/* 已加载全部 */}
      {!hasMore && totalLoaded > 0 && (
        <div className="text-sm text-base-content/40">
          已加载全部书签
        </div>
      )}
    </div>
  )
}
