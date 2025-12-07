import { useEffect, useState, useCallback, memo } from 'react'
import { analyzeImage, type ImageType } from '@/lib/image-utils'

interface AdaptiveImageProps {
  src: string
  alt: string
  className?: string
  onTypeDetected?: (type: ImageType) => void
  onError?: () => void
}

/**
 * 自适应图片组件
 * 根据图片比例自动判断类型并应用不同的样式
 */
export const AdaptiveImage = memo(function AdaptiveImage({ src, alt, className = '', onTypeDetected, onError }: AdaptiveImageProps) {
  const [imageType, setImageType] = useState<ImageType>('unknown')
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    analyzeImage(src)
      .then((info) => {
        if (!cancelled) {
          setImageType(info.type)
          onTypeDetected?.(info.type)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageType('unknown')
          setHasError(true)
          onError?.()
        }
      })

    return () => {
      cancelled = true
    }
  }, [src, onTypeDetected, onError])

  const handleLoad = useCallback(() => {
    setIsLoaded(true)
    setHasError(false)
  }, [])

  const handleError = useCallback(() => {
    setHasError(true)
    setIsLoaded(false)
    onError?.()
  }, [onError])

  if (hasError) {
    return null
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
      data-image-type={imageType}
      onLoad={handleLoad}
      onError={handleError}
    />
  )
})
