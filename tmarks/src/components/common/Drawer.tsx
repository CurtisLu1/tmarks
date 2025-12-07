'use client';

import React from 'react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  side?: 'left' | 'right';
}

export function Drawer({ isOpen, onClose, children, title, side = 'left' }: DrawerProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={side}
        className="w-[320px] max-w-[80vw] border-border bg-card p-0"
      >
        {title ? (
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-lg font-semibold text-foreground">{title}</SheetTitle>
          </SheetHeader>
        ) : null}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
