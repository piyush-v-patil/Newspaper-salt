import * as Dialog from '@radix-ui/react-dialog';
import { useUi } from '@/app/uiStore';
import { scheduleOnNextFreeDay, scheduleTaskAnyway } from '@/data/commands/sessions';
import { snoozeTask } from '@/data/commands/tasks';
import { useTask } from '@/data/queries';

const option = 'flex flex-col rounded-lg border border-line px-3 py-2.5 text-left hover:border-line-strong hover:bg-hover';

/** Shown when auto-scheduling finds no free time on the task's day. */
export function NoRoomDialog() {
  const id = useUi((s) => s.noRoomTaskId);
  const close = () => useUi.getState().setNoRoomTask(null);
  const task = useTask(id ?? undefined);
  const choose = (work: (taskId: string) => Promise<unknown>) => () => {
    if (id) void work(id);
    close();
  };

  return (
    <Dialog.Root open={id !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content className="fixed left-1/2 top-[22%] z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-pop outline-none data-[state=open]:animate-pop">
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-[16px] font-semibold tracking-tight">No free time that day</Dialog.Title>
            <Dialog.Description className="text-[13.5px] text-ink-2">
              {task ? `“${task.title}” does not fit in what is left of your working hours.` : 'This task does not fit in what is left of your working hours.'}
            </Dialog.Description>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className={option} onClick={choose(scheduleTaskAnyway)}>
              <span className="text-[14px] font-medium">Schedule anyway</span>
              <span className="text-[12.5px] text-ink-3">Book it after everything else, outside working hours.</span>
            </button>
            <button type="button" className={option} onClick={choose(scheduleOnNextFreeDay)}>
              <span className="text-[14px] font-medium">Schedule another day</span>
              <span className="text-[12.5px] text-ink-3">Move it to the next day that has room.</span>
            </button>
            <button type="button" className={option} onClick={choose(snoozeTask)}>
              <span className="text-[14px] font-medium">Defer</span>
              <span className="text-[12.5px] text-ink-3">Move it to tomorrow without a time.</span>
            </button>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="self-end rounded-md px-3 py-1.5 text-[13px] text-ink-2 hover:bg-hover">
              Cancel
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
