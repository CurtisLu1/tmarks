'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title = '确认',
  message,
  confirmText = '确定',
  cancelText = '取消',
  type = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const tone = toneMap[type];
  const Icon = icons[type];

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="flex flex-row items-start gap-3">
          <div className={`rounded-lg p-2 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const toneMap: Record<NonNullable<ConfirmDialogProps['type']>, string> = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
  error: 'bg-destructive/15 text-destructive',
  success: 'bg-green-500/15 text-green-900 dark:text-green-100',
};

const icons: Record<NonNullable<ConfirmDialogProps['type']>, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle2,
};
