/**
 * 懒加载图片组件
 * 支持图片懒加载和错误处理
 */

import { useState, useRef, useEffect, memo } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
}

export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = '',
  placeholder,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
      }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
    setHasError(false)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(false)
    onError?.()
  }

  if (hasError) {
    return placeholder ? (
      <div className={`${className} bg-base-200 flex items-center justify-center`}>
        <span className="text-base-content/50 text-xs">加载失败</span>
      </div>
    ) : null
  }

  return (
    <div className={`relative ${className}`}>
      {/* 占位符 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-base-200 animate-pulse rounded" />
      )}
      
      {/* 实际图片 */}
      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    </div>
  )
})
