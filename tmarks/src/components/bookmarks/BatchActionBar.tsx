import { useState } from 'react'
import type { BatchActionType } from '@/lib/types'
import { useBatchAction } from '@/hooks/useBookmarks'
import { useTags } from '@/hooks/useTags'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { AlertDialog } from '@/components/common/AlertDialog'
import { Z_INDEX } from '@/lib/constants/z-index'

interface BatchActionBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  onSuccess?: () => void
}

export function BatchActionBar({
  selectedIds,
  onClearSelection,
  onSuccess,
}: BatchActionBarProps) {
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingAction, setPendingAction] = useState<BatchActionType | null>(null)
  const batchAction = useBatchAction()
  const { data: tagsData } = useTags({ sort: 'name' })

  const tags = tagsData?.tags || []

  const handleAction = async (action: BatchActionType) => {
    if (selectedIds.length === 0) return

    // 需要确认的操作
    if (action === 'delete' || action === 'pin' || action === 'archive') {
      setPendingAction(action)
      setShowConfirmDialog(true)
      return
    }

    await executeAction(action)
  }

  const getSuccessMessage = (action: BatchActionType) => {
    switch (action) {
      case 'delete':
        return `成功删除 ${selectedIds.length} 个书签`
      case 'pin':
        return `成功置顶 ${selectedIds.length} 个书签`
      case 'archive':
        return `成功归档 ${selectedIds.length} 个书签`
      default:
        return '操作成功'
    }
  }

  const executeAction = async (action: BatchActionType) => {
    try {
      await batchAction.mutateAsync({
        action,
        bookmark_ids: selectedIds,
      })
      onClearSelection()
      onSuccess?.()
      setSuccessMessage(getSuccessMessage(action))
      setShowSuccessAlert(true)
    } catch (error) {
      console.error('Batch action failed:', error)
      setShowErrorAlert(true)
    }
  }

  const handleConfirm = async () => {
    setShowConfirmDialog(false)
    if (pendingAction) {
      await executeAction(pendingAction)
      setPendingAction(null)
    }
  }

  const handleCancel = () => {
    setShowConfirmDialog(false)
    setPendingAction(null)
  }

  const getConfirmDialogConfig = () => {
    switch (pendingAction) {
      case 'delete':
        return {
          title: '批量删除',
          message: `确定要删除这 ${selectedIds.length} 个书签吗？`,
          type: 'warning' as const,
        }
      case 'pin':
        return {
          title: '批量置顶',
          message: `确定要置顶这 ${selectedIds.length} 个书签吗？`,
          type: 'info' as const,
        }
      case 'archive':
        return {
          title: '批量归档',
          message: `确定要归档这 ${selectedIds.length} 个书签吗？`,
          type: 'info' as const,
        }
      default:
        return {
          title: '确认操作',
          message: '确定要执行此操作吗？',
          type: 'info' as const,
        }
    }
  }

  const handleUpdateTags = async (mode: 'add' | 'remove') => {
    if (selectedIds.length === 0 || selectedTagIds.length === 0) return

    try {
      await batchAction.mutateAsync({
        action: 'update_tags',
        bookmark_ids: selectedIds,
        add_tag_ids: mode === 'add' ? selectedTagIds : undefined,
        remove_tag_ids: mode === 'remove' ? selectedTagIds : undefined,
      })
      const message = mode === 'add'
        ? `成功为 ${selectedIds.length} 个书签添加标签`
        : `成功为 ${selectedIds.length} 个书签移除标签`
      setSuccessMessage(message)
      setShowSuccessAlert(true)
      // 操作成功后清除选择
      setSelectedTagIds([])
      setShowTagMenu(false)
      onClearSelection()
      onSuccess?.()
    } catch (error) {
      console.error('Batch update tags failed:', error)
      setShowErrorAlert(true)
    }
  }

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId))
    } else {
      setSelectedTagIds([...selectedTagIds, tagId])
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 animate-slide-up" style={{ zIndex: Z_INDEX.BATCH_ACTION_BAR }}>
      <div className="card bg-primary text-primary-content shadow-2xl">
        <div className="flex items-center gap-4">
          {/* 选中计数 */}
          <div className="text-sm font-medium">
            已选 {selectedIds.length} 个书签
          </div>

          {/* 分隔线 */}
          <div className="w-px h-6 bg-primary-content/20"></div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('pin')}
              className="btn btn-sm bg-primary-content/10 hover:bg-primary-content/20 border-none text-primary-content"
              disabled={batchAction.isPending}
              title="置顶"
            >
              置顶
            </button>

            <button
              onClick={() => handleAction('archive')}
              className="btn btn-sm bg-primary-content/10 hover:bg-primary-content/20 border-none text-primary-content"
              disabled={batchAction.isPending}
              title="归档"
            >
              归档
            </button>

            {/* 标签菜单 */}
            <div className="relative">
              <button
                onClick={() => setShowTagMenu(!showTagMenu)}
                className="btn btn-sm bg-primary-content/10 hover:bg-primary-content/20 border-none text-primary-content"
                disabled={batchAction.isPending}
              >
                标签
              </button>

              {showTagMenu && (
                <div
                  className="absolute bottom-full mb-2 left-0 w-64 text-base-content rounded-lg shadow-xl p-3 border"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="text-sm font-medium mb-2">选择标签</div>
                  <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                    {tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 p-1.5 hover:bg-muted rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag.id)}
                          onChange={() => toggleTag(tag.id)}
                          className="checkbox checkbox-sm"
                        />
                        <span className="text-sm">{tag.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => handleUpdateTags('add')}
                      className="btn btn-sm flex-1"
                      disabled={selectedTagIds.length === 0 || batchAction.isPending}
                    >
                      添加
                    </button>
                    <button
                      onClick={() => handleUpdateTags('remove')}
                      className="btn btn-sm btn-outline flex-1"
                      disabled={selectedTagIds.length === 0 || batchAction.isPending}
                    >
                      移除
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handleAction('delete')}
              className="btn btn-sm bg-error/10 hover:bg-error/20 border-none text-primary-content"
              disabled={batchAction.isPending}
              title="删除"
            >
              删除
            </button>
          </div>

          {/* 分隔线 */}
          <div className="w-px h-6 bg-primary-content/20"></div>

          {/* 取消选择 */}
          <button
            onClick={onClearSelection}
            className="btn btn-sm btn-ghost text-primary-content"
            disabled={batchAction.isPending}
          >
            取消
          </button>
        </div>
      </div>

      {/* 确认对话框 */}
      {pendingAction && (
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title={getConfirmDialogConfig().title}
          message={getConfirmDialogConfig().message}
          type={getConfirmDialogConfig().type}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* 成功提示对话框 */}
      <AlertDialog
        isOpen={showSuccessAlert}
        title="操作成功"
        message={successMessage}
        type="success"
        onConfirm={() => setShowSuccessAlert(false)}
      />

      {/* 错误提示对话框 */}
      <AlertDialog
        isOpen={showErrorAlert}
        title="操作失败"
        message="操作失败，请重试"
        type="error"
        onConfirm={() => setShowErrorAlert(false)}
      />
    </div>
  )
}
