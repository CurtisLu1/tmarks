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
  const stateClasses = isSelected
    ? 'border border-transparent bg-primary text-primary-content shadow-inner ring-1 ring-primary/40'
    : isRelated
      ? 'border border-transparent bg-accent/5 text-accent'
      : hasSelection
        ? 'border border-transparent bg-base-200/80 text-muted-foreground opacity-70 ring-1 ring-transparent'
        : 'border border-border bg-card hover:border-primary/50 ring-1 ring-transparent'

  const indicatorClasses = isSelected
    ? 'bg-primary-content/20 border-2 border-primary-content'
    : isRelated
      ? 'bg-accent/20 border-2 border-accent'
      : 'bg-transparent border-2 border-border'

  const countClasses = isSelected
    ? 'bg-primary-content/25 text-primary-content'
    : isRelated
      ? 'bg-accent/20 text-accent'
      : hasSelection
        ? 'bg-base-300 text-muted-foreground'
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
