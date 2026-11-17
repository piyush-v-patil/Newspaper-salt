import * as Dialog from '@radix-ui/react-dialog';
import { mergeTasks } from '@/data/commands/tasks';
import { useOpenTasks } from '@/data/queries';
import { BACKLOG, type Id, type Task } from '@/data/types';
import { today } from '@/domain/clock';
import { relativeDayLabel } from '@/domain/dayLabels';
import { PickerPanel } from './pickers/PickerPanel';

/** Picks the task to merge this one into. Tasks on the same day come first. */
export function MergeDialog({ task, open, onOpenChange, onMerged }: { task: Task; open: boolean; onOpenChange: (open: boolean) => void; onMerged: (targetId: Id) => void }) {
  const tasks = useOpenTasks();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[20%] z-[56] flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <div className="px-4 pb-1 pt-3.5">
            <Dialog.Title className="text-[15px] font-semibold tracking-tight">Merge into another task</Dialog.Title>
            <p className="pt-1 text-[12.5px] leading-relaxed text-ink-3">
              “{task.title}” becomes a subtask of the task you pick, bringing its subtasks, notes, tracked time and timeboxes.
            </p>
          </div>
          <PickerPanel
            wide
            label="Merge into"
            placeholder="Find a task"
            emptyText="No other open tasks match."
            getOptions={(query) => {
              const q = query.trim().toLowerCase();
              return tasks
                .filter((t) => t.id !== task.id && t.title.toLowerCase().includes(q))
                .sort((a, b) => Number(b.day === task.day) - Number(a.day === task.day))
                .slice(0, 10)
                .map((t) => ({ key: t.id, label: t.title, hint: t.day === BACKLOG ? 'Backlog' : relativeDayLabel(t.day, today()), value: t.id }));
            }}
            onSelect={(targetId) => {
              void mergeTasks(task.id, targetId).then(() => onMerged(targetId));
              onOpenChange(false);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
