/**
 * 导出功能组件
 * 提供书签数据导出功能的用户界面
 */

import { useState } from 'react'
import { Download, FileText, Code, Loader2 } from 'lucide-react'
import { ProgressIndicator } from '../common/ProgressIndicator'
import { ErrorDisplay } from '../common/ErrorDisplay'
import { useAuthStore } from '@/stores/authStore'
import type { ExportFormat, ExportOptions } from '@shared/import-export-types'

interface ExportSectionProps {
  onExport?: (format: ExportFormat, options: ExportOptions) => void
}

interface ExportStats {
  total_bookmarks: number
  total_tags: number
  pinned_bookmarks: number
  estimated_size: number
}

export function ExportSection({ onExport }: ExportSectionProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json')
  const [isExporting, setIsExporting] = useState(false)
  const [exportStats, setExportStats] = useState<ExportStats | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<{
    current: number
    total: number
    status: string
  } | null>(null)
  const [options, setOptions] = useState<ExportOptions>({
    include_tags: true,
    include_metadata: true,
    format_options: {
      pretty_print: true,
      include_click_stats: false,
      include_user_info: false
    }
  })

  // 获取导出预览信息
  const fetchExportPreview = async () => {
    try {
      const token = useAuthStore.getState().accessToken
      const response = await fetch('/api/v1/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ format: selectedFormat })
      })

      if (response.ok) {
        const data = await response.json()
        setExportStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch export preview:', error)
    }
  }

  // 执行导出
  const handleExport = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportProgress({ current: 0, total: 100, status: '准备导出...' })

    try {
      // 构建查询参数
      const params = new URLSearchParams({
        format: selectedFormat,
        include_metadata: options.include_metadata.toString(),
        include_tags: options.include_tags.toString(),
        pretty_print: options.format_options?.pretty_print?.toString() || 'true',
        include_stats: options.format_options?.include_click_stats?.toString() || 'false',
        include_user: options.format_options?.include_user_info?.toString() || 'false'
      })

      setExportProgress({ current: 25, total: 100, status: '正在生成导出数据...' })

      const token = useAuthStore.getState().accessToken
      const response = await fetch(`/api/v1/export?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Export failed')
      }

      setExportProgress({ current: 75, total: 100, status: '正在下载文件...' })

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1] ||
                     `tmarks-export-${Date.now()}.${selectedFormat}`

      // 下载文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setExportProgress({ current: 100, total: 100, status: '导出完成' })

      // 调用回调
      onExport?.(selectedFormat, options)

    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请重试'
      setExportError(message)
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
      setTimeout(() => setExportProgress(null), 2000)
    }
  }

  // 格式选项
  const formatOptions = [
    {
      value: 'json' as ExportFormat,
      label: 'JSON',
      description: 'TMarks 标准格式，包含完整数据',
      icon: Code,
      recommended: true
    },
    {
      value: 'html' as ExportFormat,
      label: 'HTML',
      description: '浏览器书签格式，兼容性好',
      icon: FileText,
      recommended: false
    }
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 标题 */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-foreground">
          导出书签
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          将您的书签数据导出为文件，支持多种格式
        </p>
      </div>

      {/* 格式选择 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">
          导出格式
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formatOptions.map((format) => {
            const Icon = format.icon
            return (
              <div
                key={format.value}
                className={`relative rounded-lg border p-3 sm:p-4 cursor-pointer transition-all touch-manipulation ${
                  selectedFormat === format.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-border/80'
                }`}
                onClick={() => setSelectedFormat(format.value)}
              >
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-foreground text-sm sm:text-base">
                        {format.label}
                      </span>
                      {format.recommended && (
                        <span className="px-2 py-0.5 text-xs bg-success/10 text-success rounded flex-shrink-0">
                          推荐
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {format.description}
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="format"
                    value={format.value}
                    checked={selectedFormat === format.value}
                    onChange={() => setSelectedFormat(format.value)}
                    className="h-4 w-4 text-primary border-border focus:ring-primary flex-shrink-0 mt-0.5"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 导出选项 */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-foreground">
          导出选项
        </label>

        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.include_tags}
              onChange={(e) => setOptions(prev => ({
                ...prev,
                include_tags: e.target.checked
              }))}
              className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              包含标签信息
            </span>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={options.include_metadata}
              onChange={(e) => setOptions(prev => ({
                ...prev,
                include_metadata: e.target.checked
              }))}
              className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
            />
            <span className="text-sm text-foreground">
              包含元数据
            </span>
          </label>

          {selectedFormat === 'json' && (
            <>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={options.format_options?.pretty_print}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    format_options: {
                      ...prev.format_options,
                      pretty_print: e.target.checked
                    }
                  }))}
                  className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                />
                <span className="text-sm text-foreground">
                  格式化 JSON（便于阅读）
                </span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={options.format_options?.include_click_stats}
                  onChange={(e) => setOptions(prev => ({
                    ...prev,
                    format_options: {
                      ...prev.format_options,
                      include_click_stats: e.target.checked
                    }
                  }))}
                  className="h-4 w-4 text-primary border-border rounded focus:ring-primary"
                />
                <span className="text-sm text-foreground">
                  包含点击统计
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* 预览信息 */}
      {exportStats && (
        <div className="bg-muted rounded-lg p-3 sm:p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            导出预览
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center sm:text-left">
              <div className="text-lg sm:text-xl font-bold text-primary">
                {exportStats.total_bookmarks}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                书签数量
              </div>
            </div>
            <div className="text-center sm:text-left">
              <div className="text-lg sm:text-xl font-bold text-success">
                {exportStats.total_tags}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                标签数量
              </div>
            </div>
            <div className="text-center sm:text-left">
              <div className="text-lg sm:text-xl font-bold text-warning">
                {exportStats.pinned_bookmarks}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                置顶书签
              </div>
            </div>
            <div className="text-center sm:text-left">
              <div className="text-lg sm:text-xl font-bold text-foreground">
                {formatFileSize(exportStats.estimated_size)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                预计大小
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导出进度 */}
      {exportProgress && (
        <ProgressIndicator
          progress={{
            current: exportProgress.current,
            total: exportProgress.total,
            percentage: (exportProgress.current / exportProgress.total) * 100,
            status: exportProgress.status
          }}
          variant="default"
          showSpeed={false}
          showETA={false}
        />
      )}

      {/* 错误显示 */}
      {exportError && (
        <ErrorDisplay
          errors={[{ message: exportError }]}
          variant="error"
          title="导出失败"
          dismissible={true}
          onDismiss={() => setExportError(null)}
          onRetry={handleExport}
        />
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
        <button
          onClick={fetchExportPreview}
          disabled={isExporting}
          className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-foreground bg-card border border-border rounded-md hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          预览信息
        </button>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 sm:py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>{isExporting ? '导出中...' : '开始导出'}</span>
        </button>
      </div>
    </div>
  )
}

// 工具函数：格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
