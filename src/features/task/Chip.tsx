import type { LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '@/ui/Popover';

interface Props {
  icon: LucideIcon;
  label: string;
  /** Accessible name; the visible label changes with the value. */
  name: string;
  active?: boolean;
  color?: string;
  children: (close: () => void) => ReactNode;
}

/** A small button showing one property of a task, with a picker behind it. */
export function Chip({ icon: Icon, label, name, active = false, color, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={name}
          className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12.5px] transition-colors hover:bg-hover ${
            active ? 'border-line-strong text-ink' : 'border-line text-ink-2'
          }`}
          style={color ? { color } : undefined}
        >
          <Icon size={13} />
          <span className="tabular max-w-[140px] truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent label={name}>{children(() => setOpen(false))}</PopoverContent>
    </PopoverRoot>
  );
}
