import { useUi } from '@/app/uiStore';
import { useTasksInState } from '@/data/queries';
import { fromDay, type Day } from '@/domain/dates';

/** Shown at the foot of today's list when the morning's rollover sent tasks to the archive. */
export function ArchiveNotice({ day }: { day: Day }) {
  const archived = useTasksInState('archived');
  const since = fromDay(day).getTime();
  const count = archived.filter((t) => (t.stateChangedAt ?? 0) >= since).length;
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => useUi.setState({ rightOpen: true, rightPanel: 'archive' })}
      className="mt-1 rounded-lg border border-dashed border-line-strong px-3 py-2 text-left text-[12.5px] text-ink-2 hover:bg-hover"
    >
      {count} {count === 1 ? 'task' : 'tasks'} moved to archive
    </button>
  );
}
