/**
 * JSON 格式导出器
 * 将书签数据导出为 TMarks 标准 JSON 格式
 */

import type { 
  Exporter, 
  TMarksExportData, 
  ExportOptions, 
  ExportOutput 
} from '../../../../shared/import-export-types'

export class JsonExporter implements Exporter {
  readonly format = 'json' as const

  async export(data: TMarksExportData, options?: ExportOptions): Promise<ExportOutput> {
    try {
      // 根据选项过滤数据
      const filteredData = this.filterData(data, options)
      
      // 格式化 JSON
      const jsonContent = this.formatJson(filteredData, options)
      
      // 生成文件名
      const filename = this.generateFilename(data.exported_at)
      
      return {
        content: jsonContent,
        filename,
        mimeType: 'application/json',
        size: new TextEncoder().encode(jsonContent).length
      }
    } catch (error) {
      throw new Error(`JSON export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private filterData(data: TMarksExportData, options?: ExportOptions): TMarksExportData {
    const filtered = { ...data }

    // 根据选项过滤标签
    if (!options?.include_tags) {
      filtered.tags = []
      filtered.bookmarks = filtered.bookmarks.map(bookmark => ({
        ...bookmark,
        tags: []
      }))
    }

    // 根据选项过滤元数据
    if (!options?.include_metadata) {
      delete filtered.metadata
    }

    // 根据选项过滤用户信息
    if (!options?.format_options?.include_user_info) {
      filtered.user = {
        id: filtered.user.id,
        email: '',
        created_at: filtered.user.created_at
      }
    }

    // 根据选项过滤点击统计
    if (!options?.format_options?.include_click_stats) {
      filtered.bookmarks = filtered.bookmarks.map(bookmark => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { click_count, last_clicked_at, ...rest } = bookmark
        return rest
      })
    }

    return filtered
  }

  private formatJson(data: TMarksExportData, options?: ExportOptions): string {
    const prettyPrint = options?.format_options?.pretty_print ?? true
    
    if (prettyPrint) {
      return JSON.stringify(data, null, 2)
    } else {
      return JSON.stringify(data)
    }
  }

  private generateFilename(exportedAt: string): string {
    const date = new Date(exportedAt)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
    
    return `tmarks-export-${dateStr}-${timeStr}.json`
  }

  /**
   * 验证导出数据的完整性
   */
  validateData(data: TMarksExportData): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需字段
    if (!data.version) errors.push('Missing version field')
    if (!data.exported_at) errors.push('Missing exported_at field')
    if (!data.user?.id) errors.push('Missing user.id field')
    if (!Array.isArray(data.bookmarks)) errors.push('Bookmarks must be an array')
    if (!Array.isArray(data.tags)) errors.push('Tags must be an array')

    // 检查书签数据
    data.bookmarks.forEach((bookmark, index) => {
      if (!bookmark.id) errors.push(`Bookmark ${index}: missing id`)
      if (!bookmark.title) errors.push(`Bookmark ${index}: missing title`)
      if (!bookmark.url) errors.push(`Bookmark ${index}: missing url`)
      if (!this.isValidUrl(bookmark.url)) errors.push(`Bookmark ${index}: invalid URL`)
      if (!Array.isArray(bookmark.tags)) errors.push(`Bookmark ${index}: tags must be an array`)
    })

    // 检查标签数据
    data.tags.forEach((tag, index) => {
      if (!tag.id) errors.push(`Tag ${index}: missing id`)
      if (!tag.name) errors.push(`Tag ${index}: missing name`)
      if (!tag.color) errors.push(`Tag ${index}: missing color`)
      if (!this.isValidColor(tag.color)) errors.push(`Tag ${index}: invalid color format`)
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private isValidColor(color: string): boolean {
    // 检查十六进制颜色格式
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
  }

  /**
   * 获取导出统计信息
   */
  getExportStats(data: TMarksExportData): {
    totalBookmarks: number
    totalTags: number
    pinnedBookmarks: number
    taggedBookmarks: number
    estimatedSize: number
  } {
    const pinnedBookmarks = data.bookmarks.filter(b => b.is_pinned).length
    const taggedBookmarks = data.bookmarks.filter(b => b.tags.length > 0).length
    const estimatedSize = new TextEncoder().encode(JSON.stringify(data)).length

    return {
      totalBookmarks: data.bookmarks.length,
      totalTags: data.tags.length,
      pinnedBookmarks,
      taggedBookmarks,
      estimatedSize
    }
  }
}

/**
 * 创建 JSON 导出器实例
 */
export function createJsonExporter(): JsonExporter {
  return new JsonExporter()
}

/**
 * 快速导出为 JSON 字符串
 */
export async function exportToJson(
  data: TMarksExportData, 
  options?: ExportOptions
): Promise<string> {
  const exporter = createJsonExporter()
  const result = await exporter.export(data, options)
  return result.content as string
}

/**
 * 导出为压缩的 JSON
 */
export async function exportToCompactJson(data: TMarksExportData): Promise<string> {
  const options: ExportOptions = {
    include_tags: true,
    include_metadata: true,
    format_options: {
      pretty_print: false,
      include_click_stats: false,
      include_user_info: false
    }
  }
  
  return exportToJson(data, options)
}
