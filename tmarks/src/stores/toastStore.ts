'use client';

import { useCallback } from 'react';

import { useToast } from '@/components/ui/toaster';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastStore {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

export function useToastStore(): ToastStore {
  const { push } = useToast();

  const addToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      push({
        title: toastTitles[type],
        description: message,
        duration: duration ?? 3500,
        variant: type,
      });
    },
    [push],
  );

  const createShortcut = useCallback(
    (type: ToastType) => (message: string, duration?: number) => addToast(type, message, duration),
    [addToast],
  );

  return {
    addToast,
    success: createShortcut('success'),
    error: createShortcut('error'),
    info: createShortcut('info'),
    warning: createShortcut('warning'),
  };
}

const toastTitles: Record<ToastType, string> = {
  success: '操作成功',
  error: '发生错误',
  info: '提示',
  warning: '警告',
};
