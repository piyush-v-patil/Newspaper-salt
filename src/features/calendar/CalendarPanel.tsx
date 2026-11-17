import { useUi } from '@/app/uiStore';
import { useToday } from '@/app/useToday';
import { relativeDayLabel } from '@/domain/dayLabels';
import { TimeGrid } from './TimeGrid';

/** The focused day on a timeline, shown beside the Today and Board views. */
export function CalendarPanel() {
  const current = useToday();
  const day = useUi((s) => s.focusedDay) ?? current;
  return (
    <div className="flex h-full w-[300px] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="text-[13px] font-semibold">Calendar</h2>
        <span className="text-[12.5px] text-ink-3">{relativeDayLabel(day, current)}</span>
      </div>
      <TimeGrid days={[day]} />
    </div>
  );
}
