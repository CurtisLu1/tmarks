'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import {
  AlertDialog as ShadcnAlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AlertDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  onConfirm: () => void;
}

export function AlertDialog({
  isOpen,
  title = '提示',
  message,
  confirmText = '确定',
  type = 'info',
  onConfirm,
}: AlertDialogProps) {
  const tone = toneMap[type];
  const Icon = icons[type];

  return (
    <ShadcnAlertDialog open={isOpen} onOpenChange={(open) => !open && onConfirm()}>
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
          <AlertDialogAction onClick={onConfirm}>{confirmText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </ShadcnAlertDialog>
  );
}

const toneMap: Record<NonNullable<AlertDialogProps['type']>, string> = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
  error: 'bg-destructive/15 text-destructive',
  success: 'bg-green-500/15 text-green-900 dark:text-green-100',
};

const icons: Record<NonNullable<AlertDialogProps['type']>, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle2,
};
