/**
 * 标签项组件 - 单个标签的展示
 */
import type { Tag } from '@/lib/types'

interface TagItemProps {
  tag: Tag
  isSelected: boolean
  isRelated: boolean
  hasSelection: boolean
  layout: 'grid' | 'masonry'
  onToggle: () => void
}

export function TagItem({ tag, isSelected, isRelated, hasSelection, layout, onToggle }: TagItemProps) {
  // 选中状态：使用浅色背景 + 主色文字
  // hasSelection 状态：保持可读性
  // 默认状态：必须有明确的文字颜色
  const stateClasses = isSelected
    ? 'border-2 border-primary bg-primary/15 text-primary shadow-sm'
    : isRelated
      ? 'border border-primary/40 bg-primary/5 text-primary'
      : hasSelection
        ? 'border border-border bg-muted/30 text-foreground'
        : 'border border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/20'

  const indicatorClasses = isSelected
    ? 'bg-primary border-2 border-primary'
    : isRelated
      ? 'bg-primary/20 border-2 border-primary/50'
      : 'bg-transparent border-2 border-border'

  const countClasses = isSelected
    ? 'bg-primary/20 text-primary font-semibold'
    : isRelated
      ? 'bg-primary/10 text-primary'
      : hasSelection
        ? 'bg-muted text-muted-foreground'
        : 'bg-muted text-muted-foreground'

  const layoutClasses = layout === 'masonry'
    ? 'inline-flex items-center gap-2 px-3 py-2 rounded-lg'
    : 'flex w-full items-center justify-between px-2.5 py-2'

  const showMarquee = isSelected || isRelated
  const marqueeStroke = isSelected ? 'var(--accent)' : 'var(--primary)'
  const marqueeOpacity = isSelected ? 0.9 : 0.65
  const marqueeDuration = isSelected ? '1s' : '3s'

  return (
    <div
      className={`relative overflow-hidden rounded-lg cursor-pointer transition-all ${stateClasses}`}
      onClick={onToggle}
    >
      {showMarquee && (
        <div className="pointer-events-none absolute inset-0 z-0 rounded-lg overflow-hidden">
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{
              background: `repeating-linear-gradient(90deg, ${marqueeStroke} 0px, ${marqueeStroke} 8px, transparent 8px, transparent 12px)`,
              opacity: marqueeOpacity,
              animation: `tag-marquee-move-right ${marqueeDuration} linear infinite`
            }}
          />
          <div
            className="absolute top-0 right-0 bottom-0 w-0.5"
            style={{
              background: `repeating-linear-gradient(0deg, ${marqueeStroke} 0px, ${marqueeStroke} 8px, transparent 8px, transparent 12px)`,
              opacity: marqueeOpacity,
              animation: `tag-marquee-move-down ${marqueeDuration} linear infinite`
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{
              background: `repeating-linear-gradient(-90deg, ${marqueeStroke} 0px, ${marqueeStroke} 8px, transparent 8px, transparent 12px)`,
              opacity: marqueeOpacity,
              animation: `tag-marquee-move-left ${marqueeDuration} linear infinite`
            }}
          />
          <div
            className="absolute top-0 left-0 bottom-0 w-0.5"
            style={{
              background: `repeating-linear-gradient(180deg, ${marqueeStroke} 0px, ${marqueeStroke} 8px, transparent 8px, transparent 12px)`,
              opacity: marqueeOpacity,
              animation: `tag-marquee-move-up ${marqueeDuration} linear infinite`
            }}
          />
        </div>
      )}
      <div className={`relative z-10 ${layoutClasses}`}>
        <div className={`flex items-center gap-2 ${layout === 'masonry' ? '' : 'flex-1 min-w-0'}`}>
          <div className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center ${indicatorClasses}`}>
            {isSelected && (
              <svg className="w-2 h-2 text-primary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          <span className={`text-xs ${layout === 'masonry' ? 'whitespace-nowrap' : 'truncate flex-1'} ${isSelected ? 'font-semibold' : 'font-medium'}`}>
            {tag.name}
          </span>

          {tag.bookmark_count !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${countClasses}`}>
              {tag.bookmark_count}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
