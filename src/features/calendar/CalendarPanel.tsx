import { Minus, Plus } from 'lucide-react';
import { useUi } from '@/app/uiStore';
import { useToday } from '@/app/useToday';
import { TimeGrid } from './TimeGrid';

const zoomButton = 'grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink';

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
      </div>
      <TimeGrid days={[day]} />
    </div>
  );
}
