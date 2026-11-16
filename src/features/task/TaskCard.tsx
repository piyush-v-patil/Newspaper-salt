import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Flag } from 'lucide-react';
import { setChannel, setDailyPriority, setPlannedTime, setTaskCompleted, moveTask } from '@/data/commands/tasks';
import { setSubtaskCompleted } from '@/data/commands/subtasks';
import type { DailyPriority, Task } from '@/data/types';
import { formatMinutes } from '@/domain/dates';
import { CheckCircle } from '@/ui/CheckCircle';
import { PopoverAnchor, PopoverContent, PopoverRoot } from '@/ui/Popover';
import { ChannelTag } from './ChannelTag';
import { useTaskData } from './TaskData';
import { ChannelPicker, DatePicker, PriorityPicker, TimePicker } from './pickers/pickers';
import { PRIORITY_LABELS } from './pickers/options';
import { useTaskFocus, type TaskActionKind } from './taskFocus';
import { useOpenTask } from './useOpenTask';

const PRIORITY_COLOR: Record<DailyPriority, string> = {
  urgent: 'text-over',
  priority: 'text-warn',
  normal: '',
  low: 'text-ink-3',
};

/** What a task card shows. Used by the list and by the copy that follows the cursor while dragging. */
export function TaskCardBody({ task }: { task: Task }) {
  const { channels, subtasks } = useTaskData();
  const openAction = useTaskFocus((s) => s.openAction);
  const channel = task.channelId ? channels.get(task.channelId) : undefined;
  const items = subtasks.get(task.id) ?? [];
  const done = task.completedAt !== null;

  const open = (kind: TaskActionKind) => (e: React.MouseEvent) => {
    e.stopPropagation();
    openAction(task.id, kind);
  };

  return (
    <>
      <div className="flex items-start gap-2.5">
        <span className="pt-px">
          <CheckCircle
            checked={done}
            onChange={(next) => void setTaskCompleted(task.id, next)}
            label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          />
        </span>
        <span
          className={`min-w-0 flex-1 break-words text-[14.5px] leading-snug transition-colors duration-200 ${
            done ? 'text-ink-3 line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </span>
        {task.dailyPriority !== 'normal' && (
          <span className={`pt-0.5 ${PRIORITY_COLOR[task.dailyPriority]}`} title={PRIORITY_LABELS[task.dailyPriority]}>
            <Flag size={13} fill="currentColor" aria-label={PRIORITY_LABELS[task.dailyPriority]} />
          </span>
        )}
        <button
          type="button"
          onClick={open('planned')}
          aria-label={task.plannedMin === null ? 'Set planned time' : `Planned time ${formatMinutes(task.plannedMin)}`}
          className={`tabular -mr-1 flex h-5 shrink-0 items-center rounded px-1 text-[12px] text-ink-3 hover:bg-hover hover:text-ink ${
            task.plannedMin === null ? 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100' : ''
          }`}
        >
          {task.plannedMin === null ? <Clock size={13} /> : formatMinutes(task.plannedMin)}
        </button>
      </div>

      {items.length > 0 && (
        <ul className="ml-[28px] mt-1.5 flex flex-col gap-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <CheckCircle
                size="sm"
                checked={s.completedAt !== null}
                onChange={(next) => void setSubtaskCompleted(s.id, next)}
                label={s.completedAt !== null ? `Reopen ${s.title}` : `Complete ${s.title}`}
              />
              <span className={`min-w-0 flex-1 truncate text-[13px] ${s.completedAt !== null ? 'text-ink-3 line-through' : 'text-ink-2'}`}>
                {s.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(channel || task.rolloverDays > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {task.rolloverDays > 0 ? (
            <span
              className="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full bg-hover px-1 text-[11px] font-medium text-ink-2"
              title={`Rolled over ${task.rolloverDays} ${task.rolloverDays === 1 ? 'day' : 'days'} in a row`}
            >
              {task.rolloverDays}
            </span>
          ) : (
            <span />
          )}
          {channel && (
            <button type="button" onClick={open('channel')} aria-label={`Channel ${channel.name}`} className="min-w-0 rounded">
              <ChannelTag channel={channel} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

const ACTION_LABEL: Record<TaskActionKind, string> = {
  planned: 'Planned time',
  channel: 'Channel',
  date: 'Move to',
  priority: 'Priority',
};

function ActionPicker({ task, kind, onDone }: { task: Task; kind: TaskActionKind; onDone: () => void }) {
  const then = (work: Promise<void>) => void work.finally(onDone);
  switch (kind) {
    case 'planned':
      return <TimePicker value={task.plannedMin} onPick={(m) => then(setPlannedTime(task.id, m))} />;
    case 'channel':
      return <ChannelPicker value={task.channelId} onPick={(id) => then(setChannel(task.id, id))} />;
    case 'date':
      return <DatePicker onPick={(day) => then(moveTask(task.id, day))} />;
    case 'priority':
      return <PriorityPicker onPick={(p) => then(setDailyPriority(task.id, p))} />;
  }
}

export const cardClass =
  'group cursor-pointer rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card transition-[border-color,box-shadow] hover:border-line-strong';

/** A task card in a list: draggable, hoverable, and the anchor for its own pickers. */
export function TaskCard({ task }: { task: Task }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: task.id });
  const selected = useTaskFocus((s) => s.selectedId === task.id);
  const actionKind = useTaskFocus((s) => (s.action?.taskId === task.id ? s.action.kind : null));
  const closeAction = useTaskFocus((s) => s.closeAction);
  const setHovered = useTaskFocus((s) => s.setHovered);
  const openTask = useOpenTask();

  return (
    <PopoverRoot open={actionKind !== null} onOpenChange={(next) => !next && closeAction()}>
      <PopoverAnchor asChild>
        <div
          ref={setNodeRef}
          style={{ transform: CSS.Translate.toString(transform), transition }}
          {...listeners}
          data-task-id={task.id}
          data-testid="task"
          onMouseEnter={() => setHovered(task.id)}
          onMouseLeave={() => useTaskFocus.getState().hoveredId === task.id && setHovered(null)}
          onClick={() => openTask(task.id)}
          className={`${cardClass} animate-card ${isDragging ? 'opacity-40' : ''} ${selected ? 'border-accent ring-1 ring-accent' : ''}`}
        >
          <TaskCardBody task={task} />
        </div>
      </PopoverAnchor>
      {actionKind && (
        <PopoverContent side="right" label={ACTION_LABEL[actionKind]}>
          <ActionPicker task={task} kind={actionKind} onDone={closeAction} />
        </PopoverContent>
      )}
    </PopoverRoot>
  );
}
