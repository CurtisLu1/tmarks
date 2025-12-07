/**
 * 标签控制组件 - 排序、布局、清空 (纯图标版)
 */
interface TagControlsProps {
  sortBy: 'usage' | 'name' | 'clicks'
  onSortChange: (sortBy: 'usage' | 'name' | 'clicks') => void
  layout: 'grid' | 'masonry'
  onLayoutChange: (layout: 'grid' | 'masonry') => void
  selectedCount: number
  onClearSelection: () => void
}

export function TagControls({
  sortBy,
  onSortChange,
  layout,
  onLayoutChange,
  selectedCount,
  onClearSelection,
}: TagControlsProps) {
  // 排序切换逻辑：usage -> clicks -> name -> usage
  const handleSortToggle = () => {
    if (sortBy === 'usage') {
      onSortChange('clicks')
    } else if (sortBy === 'clicks') {
      onSortChange('name')
    } else {
      onSortChange('usage')
    }
  }

  // 获取排序图标和提示
  const getSortIcon = () => {
    switch (sortBy) {
      case 'usage':
        return {
          icon: (
            // 使用频率图标 - 柱状图
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          title: '使用频率 (点击切换到点击次数)',
        }
      case 'clicks':
        return {
          icon: (
            // 点击次数图标 - 手指点击
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          ),
          title: '点击次数 (点击切换到字母序)',
        }
      case 'name':
        return {
          icon: (
            // 字母序图标 - A-Z
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          ),
          title: '字母序 (点击切换到使用频率)',
        }
    }
  }

  const sortConfig = getSortIcon()

  return (
    <div className="flex items-center gap-1">
      {/* 排序切换按钮 */}
      <button
        onClick={handleSortToggle}
        className="btn btn-sm btn-ghost p-2 flex-shrink-0"
        title={sortConfig.title}
      >
        {sortConfig.icon}
      </button>

      {/* 布局切换按钮 */}
      <button
        onClick={() => onLayoutChange(layout === 'grid' ? 'masonry' : 'grid')}
        className="btn btn-sm btn-ghost p-2 flex-shrink-0"
        title={layout === 'grid' ? '网格布局 (点击切换到瀑布流)' : '瀑布流布局 (点击切换到网格)'}
      >
        {layout === 'grid' ? (
          // 网格图标
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        ) : (
          // 瀑布流图标
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v4H4V5zM4 11h6v8H4v-8zM12 5h8v6h-8V5zM12 13h8v6h-8v-6z" />
          </svg>
        )}
      </button>

      {/* 清空选中按钮 */}
      <button
        onClick={onClearSelection}
        disabled={selectedCount === 0}
        className={`btn btn-sm p-2 flex-shrink-0 ${
          selectedCount === 0
            ? 'btn-disabled'
            : 'btn-ghost hover:bg-error/10 hover:text-error'
        }`}
        title={selectedCount > 0 ? `清空选中 (${selectedCount})` : '清空选中'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
