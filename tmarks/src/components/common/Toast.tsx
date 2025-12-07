'use client';

import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const COLORS = {
  success: {
    bg: 'bg-success/10',
    border: 'border-success/20',
    icon: 'text-success',
    text: 'text-success-foreground',
  },
  error: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/20',
    icon: 'text-destructive',
    text: 'text-destructive-foreground',
  },
  info: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    icon: 'text-primary',
    text: 'text-foreground',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/20',
    icon: 'text-warning',
    text: 'text-warning-foreground',
  },
}

export function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const Icon = ICONS[type]
  const colors = COLORS[type]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, onClose])

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg ${colors.bg} ${colors.border} min-w-[320px] max-w-md animate-slide-in`}
    >
      <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
      <p className={`flex-1 text-sm ${colors.text}`}>{message}</p>
      <button
        onClick={() => onClose(id)}
        className={`${colors.icon} hover:opacity-70 transition-opacity flex-shrink-0`}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onClose }: { toasts: ToastProps[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2" style={{ zIndex: 300 }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  )
}

