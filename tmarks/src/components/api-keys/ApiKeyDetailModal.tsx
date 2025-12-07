/**
 * API Key 详情模态框
 * 显示 API Key 的详细信息和使用日志
 */

import { useApiKey, useApiKeyLogs } from '@/hooks/useApiKeys'
import { getPermissionLabel } from '@shared/permissions'
import type { ApiKey } from '@/services/api-keys'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface ApiKeyDetailModalProps {
  apiKey: ApiKey
  onClose: () => void
}

export function ApiKeyDetailModal({ apiKey, onClose }: ApiKeyDetailModalProps) {
  const { data: keyData } = useApiKey(apiKey.id)
  const { data: logsData } = useApiKeyLogs(apiKey.id, 10)

  const key = keyData || apiKey
  const logs = logsData?.logs || []
  const stats = keyData?.stats

  const statusIcon = {
    active: '🟢',
    revoked: '🔴',
    expired: '🟠',
  }[key.status]

  const statusText = {
    active: '活跃',
    revoked: '已撤销',
    expired: '已过期',
  }[key.status]

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center" style={{ zIndex: 200 }}>
      <div className="card rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* 标题 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">{key.name}</h2>
            <button className="btn btn-sm" onClick={onClose}>
              关闭
            </button>
          </div>

          {/* 基本信息 */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">
              基本信息:
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="text-muted-foreground w-28">Key 前缀:</span>
                <code className="font-mono">{key.key_prefix}...</code>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-28">状态:</span>
                <span>
                  {statusIcon} {statusText}
                </span>
              </div>
              <div className="flex">
                <span className="text-muted-foreground w-28">创建时间:</span>
                <span>{new Date(key.created_at).toLocaleString('zh-CN')}</span>
              </div>
              {key.expires_at && (
                <div className="flex">
                  <span className="text-muted-foreground w-28">过期时间:</span>
                  <span>
                    {new Date(key.expires_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
              {!key.expires_at && (
                <div className="flex">
                  <span className="text-muted-foreground w-28">过期时间:</span>
                  <span>永不过期</span>
                </div>
              )}
              {key.description && (
                <div className="flex">
                  <span className="text-muted-foreground w-28">描述:</span>
                  <span>{key.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* 权限列表 */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-3">权限:</h3>
            <div className="grid grid-cols-1 gap-2">
              {key.permissions.map((perm) => (
                <div
                  key={perm}
                  className="text-xs bg-primary/10 text-primary px-3 py-2 rounded flex items-center gap-2"
                >
                  <span>✓</span>
                  <span className="font-medium">{getPermissionLabel(perm)}</span>
                  <span className="text-primary/60">({perm})</span>
                </div>
              ))}
            </div>
          </div>

          {/* 使用情况 */}
          {stats && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-foreground mb-3">
                使用情况:
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex">
                  <span className="text-muted-foreground w-28">最后使用:</span>
                  <span>
                    {stats.last_used_at
                      ? formatDistanceToNow(new Date(stats.last_used_at), {
                          addSuffix: true,
                          locale: zhCN,
                        })
                      : '从未使用'}
                  </span>
                </div>
                <div className="flex">
                  <span className="text-muted-foreground w-28">使用次数:</span>
                  <span>{stats.total_requests} 次</span>
                </div>
                {stats.last_used_ip && (
                  <div className="flex">
                    <span className="text-muted-foreground w-28">最后 IP:</span>
                    <span>{stats.last_used_ip}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 最近活动 */}
          {logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">
                最近活动: (最多显示 10 条)
              </h3>
              <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">时间</th>
                      <th className="text-left px-3 py-2 font-medium">方法</th>
                      <th className="text-left px-3 py-2 font-medium">端点</th>
                      <th className="text-left px-3 py-2 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => (
                      <tr
                        key={index}
                        className="border-t border-border hover:bg-muted/50"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2">
                          <code className="text-xs">{log.method}</code>
                        </td>
                        <td className="px-3 py-2 font-mono">{log.endpoint}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              log.status < 300
                                ? 'text-success'
                                : log.status < 400
                                  ? 'text-warning'
                                  : 'text-error'
                            }
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {logs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-6">
              暂无使用记录
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
