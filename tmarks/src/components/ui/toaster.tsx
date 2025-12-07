'use client';

import * as React from 'react';

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastItem = {
  id: number;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  variant?: ToastVariant;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, 'id'>) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <Toaster />');
  return ctx;
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const push = React.useCallback((toast: Omit<ToastItem, 'id'>) => {
    idRef.current += 1;
    setItems((prev) => [...prev, { id: idRef.current, variant: 'info', ...toast }]);
  }, []);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      <ToastProvider swipeDirection="right">
        {children}
        <ToastViewport />
        {items.map((toast) => (
          <Toast
            key={toast.id}
            duration={toast.duration ?? 3500}
            onOpenChange={(open) => !open && remove(toast.id)}
            className={cn(
              'pr-10',
              variantClasses[toast.variant ?? 'info'],
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-current">{variantIcons[toast.variant ?? 'info']}</span>
              <div className="flex-1 space-y-1">
                {toast.title ? <ToastTitle>{toast.title}</ToastTitle> : null}
                {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
              </div>
            </div>
            {toast.actionLabel ? (
              <ToastAction altText={toast.actionLabel} asChild>
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    remove(toast.id);
                  }}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {toast.actionLabel}
                </button>
              </ToastAction>
            ) : null}
            <ToastClose />
          </Toast>
        ))}
      </ToastProvider>
    </ToastContext.Provider>
  );
}

const variantClasses: Record<ToastVariant, string> = {
  info: 'border-primary/30 bg-primary/5',
  success: 'border-green-500/40 bg-green-500/10 text-green-900 dark:text-green-50',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  info: <Info className="h-5 w-5" />,
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
};

