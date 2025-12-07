import { useState, useRef, useEffect } from 'react'
import { GripVertical, RotateCcw } from 'lucide-react'

interface ResizablePanelProps {
  children: React.ReactNode
  side: 'left' | 'right'
  defaultWidth: number
  minWidth: number
  maxWidth: number
  storageKey: string
}

export function ResizablePanel({
  children,
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? parseInt(saved, 10) : defaultWidth
  })
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(storageKey, width.toString())
  }, [width, storageKey])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return

      const rect = panelRef.current.getBoundingClientRect()
      let newWidth: number

      if (side === 'left') {
        newWidth = e.clientX - rect.left
      } else {
        newWidth = rect.right - e.clientX
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, side, minWidth, maxWidth])

  const handleReset = () => {
    setWidth(defaultWidth)
  }

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 bg-card h-full"
      style={{ width: `${width}px` }}
    >
      {children}

      {/* Resize Handle */}
      <div
        className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} h-full w-1 cursor-col-resize group hover:bg-primary transition-colors ${
          isResizing ? 'bg-primary' : 'bg-transparent'
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Grip Icon */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 bg-card border border-border rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-card border border-border rounded shadow-sm hover:bg-muted hover:shadow-md transition-all opacity-0 hover:opacity-100 group-hover:opacity-100"
        title="恢复默认宽度"
      >
        <RotateCcw className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )
}

