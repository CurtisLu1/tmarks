'use client';

import React from 'react';

import {
  DropdownMenu as ShadDropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, items, align = 'right' }: DropdownMenuProps) {
  return (
    <ShadDropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="inline-flex">{trigger}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-[220px]"
        align={align === 'left' ? 'start' : 'end'}
      >
        {items.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {item.divider && index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={item.disabled}
              onSelect={() => {
                if (!item.disabled) {
                  item.onClick();
                }
              }}
              className={item.danger ? 'text-destructive focus:text-destructive' : undefined}
            >
              {item.icon ? <span className="mr-2 flex-shrink-0">{item.icon}</span> : null}
              <span className="flex-1">{item.label}</span>
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </ShadDropdownMenu>
  );
}
