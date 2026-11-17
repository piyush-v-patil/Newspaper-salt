import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useSearch } from '@tanstack/react-router';
import { Copy, Ellipsis, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  deleteTask,
  duplicateTask,
  moveTask,
  renameTask,
  setChannel,
  setDailyPriority,
  setPlannedTime,
  setTaskCompleted,
} from '@/data/commands/tasks';
import { useSubtasks, useTask } from '@/data/queries';
import type { Task } from '@/data/types';
import { CheckCircle } from '@/ui/CheckCircle';
import { ActualChip } from './ActualChip';
import { NotesEditor } from './NotesEditor';
import { Subtasks } from './Subtasks';
import { TaskChips } from './TaskChips';
import { useOpenTask } from './useOpenTask';

export function TitleField({ task, large = false }: { task: Task; large?: boolean }) {
  const [value, setValue] = useState(task.title);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(task.title), [task.title]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function commit() {
    if (value.trim() && value.trim() !== task.title) void renameTask(task.id, value);
    else setValue(task.title);
  }

  return (
    <textarea
      ref={area}
      rows={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      aria-label="Task title"
      className={`min-w-0 flex-1 resize-none bg-transparent font-semibold leading-snug tracking-tight outline-none ${large ? 'text-[26px]' : 'text-[19px]'} ${
        task.completedAt !== null ? 'text-ink-3 line-through' : ''
      }`}
    />
  );
}

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] text-ink-2 outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink';

function TaskPageBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const subtasks = useSubtasks([task.id]).get(task.id) ?? [];
  const done = task.completedAt !== null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <TaskChips
          day={task.day}
          plannedMin={task.plannedMin}
          channelId={task.channelId}
          priority={task.dailyPriority}
          onDay={(day) => void moveTask(task.id, day)}
          onPlanned={(m) => void setPlannedTime(task.id, m)}
          onChannel={(id) => void setChannel(task.id, id)}
          onPriority={(p) => void setDailyPriority(task.id, p)}
          />
          <ActualChip task={task} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Menu.Root>
            <Menu.Trigger asChild>
              <button type="button" aria-label="More actions" className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover">
                <Ellipsis size={16} />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-[168px] rounded-lg border border-line bg-surface p-1 shadow-pop data-[state=open]:animate-pop">
                <Menu.Item className={menuItem} onSelect={() => void duplicateTask(task.id)}>
                  <Copy size={14} /> Duplicate
                </Menu.Item>
                <Menu.Item
                  className={`${menuItem} data-[highlighted]:!text-over`}
                  onSelect={() => {
                    onClose();
                    void deleteTask(task.id);
                  }}
                >
                  <Trash2 size={14} /> Delete
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          <Dialog.Close asChild>
            <button type="button" aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover">
              <X size={16} />
            </button>
          </Dialog.Close>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="pt-1">
            <CheckCircle
              checked={done}
              onChange={(next) => void setTaskCompleted(task.id, next)}
              label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            />
          </span>
          <TitleField task={task} />
        </div>
        <section aria-label="Subtasks" className="pl-[26px]">
          <Subtasks taskId={task.id} subtasks={subtasks} />
        </section>
        <section aria-label="Notes" className="border-t border-line pl-[30px] pt-4">
          <NotesEditor key={task.id} taskId={task.id} initial={task.notes} />
        </section>
      </div>
    </>
  );
}

/** The full view of one task, opened over whatever view is showing. */
export function TaskPage() {
  const { task: id } = useSearch({ strict: false }) as { task?: string };
  const task = useTask(id);
  const openTask = useOpenTask();
  const close = () => openTask(null);
  const showing = task && task.state === 'active' ? task : null;

  return (
    <Dialog.Root open={showing !== null} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 data-[state=open]:animate-fade" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-[9%] z-50 flex max-h-[82vh] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 flex-col rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-pop"
        >
          <Dialog.Title className="sr-only">{showing?.title ?? 'Task'}</Dialog.Title>
          {showing && <TaskPageBody task={showing} onClose={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
