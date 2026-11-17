import { Minus, Plus, Timer } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import { useToday } from '@/app/useToday';
import { TimeGrid } from './TimeGrid';

const zoomButton = 'grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink';

/** Shows or hides the time actually worked, drawn beside the plan. */
export function TrackedToggle({ compact = false }: { compact?: boolean }) {
  const on = useUi((s) => s.showTracked);
  const toggle = useUi((s) => s.toggleTracked);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label="Show tracked time"
      title={on ? 'Hide tracked time' : 'Show tracked time'}
      onClick={toggle}
      className={
        compact
          ? `ml-auto flex h-5 items-center gap-1 rounded px-1 text-[11.5px] ${on ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-hover hover:text-ink'}`
          : `flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12.5px] ${on ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2 hover:bg-hover hover:text-ink'}`
      }
    >
      <Timer size={compact ? 12 : 14} /> {compact ? 'Tracked' : 'Tracked time'}
    </button>
  );
}

/** The focused day on a timeline, beside the Today and Board views. */
export function CalendarPanel() {
  const current = useToday();
  const day = useUi((s) => s.focusedDay) ?? current;
  const zoom = useUi((s) => s.zoomCalendar);
  return (
    <div className="relative flex h-full w-[max(300px,100%)] flex-col">
      <div className="flex h-7 shrink-0 items-center gap-0.5 px-2">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1)} className={zoomButton}>
          <Plus size={13} />
        </button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(-1)} className={zoomButton}>
          <Minus size={13} />
        </button>
        <TrackedToggle compact />
      </div>
      <TimeGrid days={[day]} />
    </div>
  );
}
