import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-surface px-1 font-sans text-[10.5px] font-medium text-ink-3">
      {children}
    </kbd>
  );
}
