import { Layers, Search } from 'lucide-react'

interface EmptyStateProps {
  isSearching: boolean
  searchQuery?: string
}

export function EmptyState({ isSearching, searchQuery }: EmptyStateProps) {
  if (isSearching) {
    return (
      <div className="text-center py-16">
        <Search className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          没有找到匹配的标签页组
        </h3>
        <p className="text-muted-foreground">
          尝试使用不同的关键词搜索 "{searchQuery}"
        </p>
      </div>
    )
  }

  return (
    <div className="text-center py-16 w-full">
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Layers className="w-12 h-12 text-primary" />
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-3">
        还没有标签页组
      </h3>
      <p className="text-muted-foreground mb-6">
        使用浏览器扩展收集标签页，或者在这里创建新的标签页组来开始管理您的标签页
      </p>
      <div className="flex items-center justify-center gap-4">
        <div className="text-sm text-muted-foreground/80">
          💡 提示：安装浏览器扩展可以快速收集当前窗口的所有标签页
        </div>
      </div>
    </div>
  )
}

