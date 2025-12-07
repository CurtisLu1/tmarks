/**
 * Markdown 书签解析器
 * 解析 Markdown 格式的书签文件
 * 支持格式: - [标题](URL)
 */

import type { 
  ImportParser, 
  ImportData, 
  ParsedBookmark, 
  ParsedTag, 
  ValidationResult 
} from '../../../../shared/import-export-types'

export class MarkdownParser implements ImportParser {
  readonly format = 'markdown' as const

  async parse(content: string): Promise<ImportData> {
    try {
      const bookmarks = this.parseBookmarks(content)
      const tags = this.extractTags(bookmarks)
      
      return {
        bookmarks,
        tags,
        metadata: {
          source: 'markdown',
          total_items: bookmarks.length,
          parsed_at: new Date().toISOString()
        }
      }
    } catch (error) {
      throw new Error(`Markdown parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async validate(data: ImportData): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string; value?: unknown }> = []
    const warnings: Array<{ field: string; message: string; value?: unknown }> = []

    // 验证书签
    data.bookmarks.forEach((bookmark, index) => {
      if (!bookmark.title) {
        errors.push({
          field: `bookmarks[${index}].title`,
          message: 'Title is required'
        })
      }

      if (!bookmark.url) {
        errors.push({
          field: `bookmarks[${index}].url`,
          message: 'URL is required'
        })
      } else if (!this.isValidUrl(bookmark.url)) {
        errors.push({
          field: `bookmarks[${index}].url`,
          message: 'Invalid URL format',
          value: bookmark.url
        })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  private parseBookmarks(content: string): ParsedBookmark[] {
    const bookmarks: ParsedBookmark[] = []
    const lines = content.split('\n')
    
    let currentFolder: string[] = []
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // 解析标题(文件夹)
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
      if (headerMatch) {
        const level = headerMatch[1].length
        const title = headerMatch[2].trim()
        
        // 更新文件夹路径
        currentFolder = currentFolder.slice(0, level - 1)
        currentFolder[level - 1] = title
        continue
      }
      
      // 解析书签链接: - [标题](URL) 或 * [标题](URL)
      const linkMatch = trimmedLine.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)/)
      if (linkMatch) {
        const title = linkMatch[1].trim()
        const url = linkMatch[2].trim()
        
        // 过滤掉锚点链接
        if (url.startsWith('#')) {
          continue
        }
        
        const folderPath = currentFolder.filter(Boolean).join('/')
        
        bookmarks.push({
          title,
          url,
          tags: this.parseTags(folderPath),
          folder: folderPath || undefined
        })
      }
    }
    
    return bookmarks
  }

  private parseTags(folderPath: string): string[] {
    if (!folderPath) return []
    
    // 将文件夹路径转换为标签
    return folderPath.split('/').map(tag => this.normalizeTag(tag)).filter(Boolean)
  }

  private normalizeTag(tag: string): string {
    return tag
      .trim()
      .replace(/[^\w\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格、连字符
      .replace(/\s+/g, '-') // 空格转连字符
      .substring(0, 50) // 限制长度
  }

  private extractTags(bookmarks: ParsedBookmark[]): ParsedTag[] {
    const tagSet = new Set<string>()
    
    bookmarks.forEach(bookmark => {
      bookmark.tags.forEach(tag => tagSet.add(tag))
    })
    
    return Array.from(tagSet).map(name => ({
      name,
      color: this.generateTagColor(name)
    }))
  }

  private generateTagColor(tagName: string): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
      '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
      '#ec4899', '#6366f1', '#14b8a6', '#eab308'
    ]
    
    let hash = 0
    for (let i = 0; i < tagName.length; i++) {
      hash = ((hash << 5) - hash + tagName.charCodeAt(i)) & 0xffffffff
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
}

export function createMarkdownParser(): MarkdownParser {
  return new MarkdownParser()
}

