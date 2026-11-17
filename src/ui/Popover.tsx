import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

export const PopoverRoot = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

interface ContentProps {
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  label: string;
}

export function PopoverContent({ children, side = 'bottom', align = 'start', label }: ContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={12}
        aria-label={label}
        className="z-50 overflow-hidden rounded-lg border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
