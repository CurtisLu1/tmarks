/**
 * API Key 卡片组件
 * 显示单个 API Key 的摘要信息
 */

import type { ApiKey } from '@/services/api-keys'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ApiKeyCardProps {
  apiKey: ApiKey
  onViewDetails: () => void
  onRevoke: () => void
  onDelete?: () => void
}

export function ApiKeyCard({ apiKey, onViewDetails, onRevoke, onDelete }: ApiKeyCardProps) {
  const statusIcon = {
    active: '🟢',
    revoked: '🔴',
    expired: '🟠',
  }[apiKey.status]

  const statusText = {
    active: '活跃',
    revoked: '已撤销',
    expired: '已过期',
  }[apiKey.status]

  const lastUsedText = apiKey.last_used_at
    ? formatDistanceToNow(new Date(apiKey.last_used_at), {
        addSuffix: true,
        locale: zhCN,
      })
    : '从未使用'

  return (
    <div className="p-3 sm:p-4 md:p-5 bg-gradient-to-br from-primary/5 to-secondary/5 border border-primary/20 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* 名称和前缀 */}
          <div className="mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1 truncate">
              {apiKey.name}
            </h3>
            <code className="text-xs sm:text-sm text-muted-foreground font-mono break-all">
              {apiKey.key_prefix}...
            </code>
          </div>

          {/* 描述 */}
          {apiKey.description && (
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 leading-relaxed">
              {apiKey.description}
            </p>
          )}

          {/* 元信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <span>状态:</span>
              <span>{statusIcon}</span>
              <strong>{statusText}</strong>
            </div>
            <div>
              权限: <strong>{apiKey.permissions.length} 项</strong>
            </div>
            <div>
              最后使用: <strong className="break-words">{lastUsedText}</strong>
            </div>
            <div>
              创建于:{' '}
              <strong>
                {new Date(apiKey.created_at).toLocaleDateString('zh-CN')}
              </strong>
            </div>
            {apiKey.expires_at && (
              <div className="sm:col-span-2">
                过期时间:{' '}
                <strong>
                  {new Date(apiKey.expires_at).toLocaleDateString('zh-CN')}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-4">
          <button className="btn btn-sm w-full sm:w-auto touch-manipulation" onClick={onViewDetails}>
            查看详情
          </button>
          {apiKey.status === 'active' && (
            <button className="btn btn-sm btn-error w-full sm:w-auto touch-manipulation" onClick={onRevoke}>
              撤销
            </button>
          )}
          {onDelete && (
            <button
              className={`btn btn-sm w-full sm:w-auto touch-manipulation ${apiKey.status === 'active' ? 'btn-outline btn-error' : 'btn-error'}`}
              onClick={onDelete}
            >
              删除
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
