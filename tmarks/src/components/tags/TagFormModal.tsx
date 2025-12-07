import { useEffect, useState } from 'react'

interface TagFormModalProps {
  isOpen: boolean
  title: string
  initialName: string
  onConfirm: (name: string) => void
  onCancel: () => void
  confirmLabel?: string
  isSubmitting?: boolean
  onDelete?: () => void
  isDeleting?: boolean
}

export function TagFormModal({
  isOpen,
  title,
  initialName,
  onConfirm,
  onCancel,
  confirmLabel = '保存',
  isSubmitting = false,
  onDelete,
  isDeleting = false,
}: TagFormModalProps) {
  const [name, setName] = useState(initialName)

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
    }
  }, [initialName, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 210 }}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm card p-5 space-y-4 animate-scale-in border border-border shadow-2xl rounded-xl">
        <div>
          <h3 className="text-base font-semibold mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground">调整标签名称，仅影响当前标签。</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">标签名称</label>
          <input
            type="text"
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入标签名称"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSubmitting) onConfirm(name.trim())
              if (e.key === 'Escape') onCancel()
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              type="button"
              className="btn btn-sm btn-error"
              onClick={onDelete}
              disabled={isSubmitting || isDeleting}
            >
              {isDeleting ? '删除中...' : '删除标签'}
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={onCancel}
              disabled={isSubmitting || isDeleting}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onConfirm(name.trim())}
              disabled={!name.trim() || isSubmitting || isDeleting}
            >
              {isSubmitting ? '保存中...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
