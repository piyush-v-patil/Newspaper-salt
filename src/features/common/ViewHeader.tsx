import { Link } from '@tanstack/react-router';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavToggle } from '@/app/LeftNav';
import { useProfile } from '@/data/ReferenceData';
import { FilterButton } from './FilterButton';

interface Props {
  /** Shown after the controls; the Today view leaves it out and heads its list with the date instead. */
  title?: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Labels for the arrows, e.g. "Previous day". */
  stepLabel?: 'day' | 'week' | 'month';
  children?: ReactNode;
}

export const headerButton = 'flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[12.5px] text-ink-2 hover:bg-hover hover:text-ink';
const square = 'grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink';

/** The person's initial, linking to Settings. */
function Avatar() {
  const { name } = useProfile();
  return (
    <Link
      to="/settings"
      aria-label="Settings"
      title="Settings"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-semibold uppercase text-white hover:opacity-90"
    >
      {name.trim().charAt(0) || '·'}
    </Link>
  );
}

/** Arrows, Today and Filter on the left; view controls and the avatar on the right. */
export function ViewHeader({ title, onPrevious, onNext, onToday, stepLabel = 'day', children }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-4">
      <NavToggle />
      <button type="button" aria-label={`Previous ${stepLabel}`} onClick={onPrevious} className={square}>
        <ChevronLeft size={15} />
      </button>
      <button type="button" aria-label={`Next ${stepLabel}`} onClick={onNext} className={square}>
        <ChevronRight size={15} />
      </button>
      <button type="button" onClick={onToday} className={headerButton}>
        <CalendarDays size={14} /> Today
      </button>
      <FilterButton />
      {title && <h1 className="ml-2 min-w-0 truncate text-[15px] font-semibold tracking-tight">{title}</h1>}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {children}
        <Avatar />
      </div>
    </header>
  );
}
