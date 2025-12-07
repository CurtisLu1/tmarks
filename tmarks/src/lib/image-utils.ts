/**
 * 图片工具模块
 * 用于检测图片比例、类型判断和自适应处理
 */

export type ImageType = 'favicon' | 'cover' | 'unknown'

export interface ImageInfo {
  type: ImageType
  width: number
  height: number
  aspectRatio: number
}

/**
 * 加载图片并获取其尺寸信息
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))

    img.src = url
  })
}

/**
 * 判断图片类型
 * - favicon: 正方形或接近正方形的图标 (宽高比在 0.8-1.25 之间)
 * - cover: 横向长方形封面图 (宽度明显大于高度)
 * - unknown: 其他类型
 */
export function detectImageType(width: number, height: number): ImageType {
  if (width === 0 || height === 0) {
    return 'unknown'
  }

  const aspectRatio = width / height

  // 正方形或接近正方形 (0.8 - 1.25)
  if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    return 'favicon'
  }

  // 横向长方形 (宽度大于高度)
  if (aspectRatio > 1.25) {
    return 'cover'
  }

  // 纵向或其他
  return 'unknown'
}

/**
 * 分析图片并返回完整信息
 */
export async function analyzeImage(url: string): Promise<ImageInfo> {
  try {
    const img = await loadImage(url)
    const type = detectImageType(img.naturalWidth, img.naturalHeight)

    return {
      type,
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalWidth / img.naturalHeight,
    }
  } catch {
    return {
      type: 'unknown',
      width: 0,
      height: 0,
      aspectRatio: 0,
    }
  }
}

/**
 * 获取图片的 CSS 类名，用于不同类型的样式
 */
export function getImageClassName(type: ImageType): string {
  switch (type) {
    case 'favicon':
      return 'image-favicon'
    case 'cover':
      return 'image-cover'
    default:
      return 'image-unknown'
  }
}
