import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavToggle } from '@/app/LeftNav';
import { FilterButton } from './FilterButton';

interface Props {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  /** Shown only when the view has moved away from today. */
  onBackToToday?: () => void;
  children?: ReactNode;
}

const arrow = 'grid h-7 w-7 place-items-center rounded text-ink-2 hover:bg-hover';

/** Date controls on the left, filter on the right. Shared by the Today and Board views. */
export function ViewHeader({ title, onPrevious, onNext, onBackToToday, children }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-6">
      <NavToggle />
      <div className="flex shrink-0 items-center">
        <button type="button" aria-label="Previous day" onClick={onPrevious} className={arrow}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" aria-label="Next day" onClick={onNext} className={arrow}>
          <ChevronRight size={16} />
        </button>
      </div>
      <h1 className="min-w-0 truncate text-[16px] font-semibold tracking-tight">{title}</h1>
      {onBackToToday && (
        <button type="button" onClick={onBackToToday} className="ml-2 h-7 shrink-0 whitespace-nowrap rounded-md border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-hover">
          Back to today
        </button>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {children}
        <FilterButton />
      </div>
    </header>
  );
}
