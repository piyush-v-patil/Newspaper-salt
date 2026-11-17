import { useSortable } from '@dnd-kit/sortable';
import { useNavigate } from '@tanstack/react-router';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, Clock, Flag, Repeat, Target } from 'lucide-react';
import { autoScheduleTask } from '@/data/commands/sessions';
import { useUi } from '@/app/uiStore';
import { setBacklogPriority, setChannel, setDailyPriority, setPlannedTime, setTaskCompleted, moveTask } from '@/data/commands/tasks';
import { setSubtaskCompleted } from '@/data/commands/subtasks';
import { useNow } from '@/app/useNow';
import { PLANNING_CARD, WEEKLY_PLANNING_CARD, WEEKLY_REVIEW_CARD } from '@/data/commands/days';
import { linkTask } from '@/data/commands/objectives';
import { setActualForDay } from '@/data/commands/timer';
import { useRunningTimer } from '@/data/queries';
import { BACKLOG, type BacklogPriority, type DailyPriority, type Task } from '@/data/types';
import { BACKLOG_PRIORITIES } from '@/domain/backlog';
import { today } from '@/domain/clock';
import { msToMinutes } from '@/domain/time';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import { formatClock, formatMinutes, toDay } from '@/domain/dates';
import { CheckCircle } from '@/ui/CheckCircle';
import { PopoverAnchor, PopoverContent, PopoverRoot } from '@/ui/Popover';
import { useTaskData } from './TaskData';
import { BacklogPriorityPicker, ChannelPicker, DatePicker, ObjectivePicker, PriorityPicker, TimePicker } from './pickers/pickers';
import { PRIORITY_LABELS } from './pickers/options';
import { useTaskFocus, type TaskActionKind } from './taskFocus';
import { useOpenTask } from './useOpenTask';

/** Priority shows as a soft coloured pill with its name. */
const PRIORITY_PILL: Record<DailyPriority, string> = {
  urgent: 'bg-over/12 text-over',
  priority: 'bg-accent-soft text-accent',
  normal: '',
  low: 'bg-hover text-ink-3',
};

const BACKLOG_PRIORITY_PILL: Record<BacklogPriority, string> = {
  urgent: 'bg-over/12 text-over',
  high: 'bg-warn/15 text-warn',
  medium: 'bg-accent-soft text-accent',
  low: 'bg-hover text-ink-3',
  none: '',
};

/** Actual and planned time on a card: "0:42 / 1:30". Ticks while this task's timer runs. */
function CardTime({ task, onOpen }: { task: Task; onOpen: (e: React.MouseEvent) => void }) {
  const { actual } = useTaskData();
  const timer = useRunningTimer();
  const running = timer?.taskId === task.id;
  const nowMs = useNow(1000, running);
  const tracked = actual.get(task.id);
  // A card on a day shows that day's time; in the backlog, all of it.
  const onDay = task.day === BACKLOG ? tracked?.totalMs : tracked?.byDay.get(task.day);
  const runningOnThisDay = running && (task.day === BACKLOG || toDay(new Date(timer.start)) === task.day);
  const actualMin = msToMinutes((onDay ?? 0) + (runningOnThisDay ? nowMs - timer.start : 0));
  const hasActual = actualMin > 0 || running || task.plannedMin !== null;
  const empty = task.plannedMin === null && !hasActual;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="card-time"
      aria-label={task.plannedMin === null ? 'Set planned time' : `Planned time ${formatMinutes(task.plannedMin)}`}
      className={`tabular flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[11.5px] text-ink-2 hover:text-ink ${
        empty ? 'opacity-0 hover:bg-hover focus-visible:opacity-100 group-hover:opacity-100' : 'bg-hover'
      }`}
    >
      {empty && <Clock size={13} />}
      {hasActual && <span className={running ? 'font-medium text-accent' : ''}>{formatMinutes(actualMin)}</span>}
      {hasActual && <span className="text-ink-3">/</span>}
      {!empty && <span>{task.plannedMin === null ? '–:––' : formatMinutes(task.plannedMin)}</span>}
    </button>
  );
}

/** A quick action on a hovered card: a grey icon, coloured when that thing is set. */
function CardIcon({ label, active, onClick, children }: { label: string; active?: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`grid h-6 w-6 place-items-center rounded hover:bg-hover ${active ?? 'text-ink-3 hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

/** What a task card shows. Used by the list and by the copy that follows the cursor while dragging. */
export function TaskCardBody({ task }: { task: Task }) {
  const { subtasks, sessions } = useTaskData();
  const channels = useChannelMap();
  const timeFormat = useSettings().timeFormat;
  // The first timebox on the day the card sits on.
  const scheduled = sessions.get(task.id)?.find((s) => s.day === task.day);
  const openAction = useTaskFocus((s) => s.openAction);
  const channel = task.channelId ? channels.get(task.channelId) : undefined;
  const items = subtasks.get(task.id) ?? [];
  const done = task.completedAt !== null;
  // A task on a day shows its daily priority; in the backlog, its backlog priority.
  const flag =
    task.day === BACKLOG
      ? task.backlogPriority !== 'none'
        ? { pill: BACKLOG_PRIORITY_PILL[task.backlogPriority], label: BACKLOG_PRIORITIES.find((p) => p.id === task.backlogPriority)!.label }
        : null
      : task.dailyPriority !== 'normal'
        ? { pill: PRIORITY_PILL[task.dailyPriority], label: PRIORITY_LABELS[task.dailyPriority] }
        : null;

  const open = (kind: TaskActionKind) => (e: React.MouseEvent) => {
    e.stopPropagation();
    openAction(task.id, kind);
  };

  const rollover = task.rolloverDays > 0 && (
    <span
      className="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full bg-hover px-1 text-[11px] font-medium text-ink-2"
      title={`Rolled over ${task.rolloverDays} ${task.rolloverDays === 1 ? 'day' : 'days'} in a row`}
    >
      {task.rolloverDays}
    </span>
  );

  return (
    <>
      {/* Top: when it is on the calendar, and actual against planned time. */}
      <div className="flex min-h-5 items-center justify-between gap-2">
        {scheduled ? (
          <span
            className="time-pill tabular flex h-5 items-center rounded px-1.5 text-[11.5px]"
            style={{ '--tag': channel?.color ?? 'var(--ink-3)' } as React.CSSProperties}
            title="Scheduled on the calendar"
          >
            {formatClock(scheduled.startMin, timeFormat).toLowerCase()}
          </span>
        ) : (
          <span />
        )}
        <CardTime task={task} onOpen={open('planned')} />
      </div>

      <p className={`mt-1 break-words text-[14.5px] leading-snug transition-colors duration-200 ${done ? 'text-ink-3 line-through' : 'text-ink'}`}>{task.title}</p>

      {items.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <CheckCircle
                size="sm"
                checked={s.completedAt !== null}
                onChange={(next) => void setSubtaskCompleted(s.id, next)}
                label={s.completedAt !== null ? `Reopen ${s.title}` : `Complete ${s.title}`}
              />
              <span className={`min-w-0 flex-1 truncate text-[13px] ${s.completedAt !== null ? 'text-ink-3 line-through' : 'text-ink-2'}`}>{s.title}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom: complete, then what is set on the task; on hover, quick actions instead. The channel on the right. */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <CheckCircle checked={done} onChange={(next) => void setTaskCompleted(task.id, next)} label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} />
          <span className="flex min-w-0 items-center gap-1.5 group-hover:hidden group-data-[selected]:hidden">
            {flag && (
              <button
                type="button"
                onClick={open('priority')}
                aria-label={flag.label}
                title="Priority"
                className={`rounded px-1.5 py-px text-[11px] font-medium ${flag.pill}`}
              >
                {flag.label}
              </button>
            )}
            {task.seriesId && (
              <span className="text-ink-3" title="Repeats">
                <Repeat size={12} aria-label="Repeats" />
              </span>
            )}
            {task.objectiveId && (
              <button type="button" onClick={open('objective')} title="Linked to a weekly objective" className="flex items-center gap-1 rounded text-[11px] font-medium text-ink-2 hover:text-ink">
                <Target size={11} /> This week
              </button>
            )}
          </span>
          {task.kind !== 'ritual' && (
            <span className="hidden items-center gap-0.5 group-hover:flex group-data-[selected]:flex">
              <CardIcon label="Change date" onClick={open('date')}>
                <CalendarDays size={15} />
              </CardIcon>
              <CardIcon
                label={scheduled ? 'Scheduled' : 'Timebox'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (scheduled) return;
                  void autoScheduleTask(task.id, { allowSplit: true }).then((result) => {
                    if (result === 'no-room') useUi.getState().setNoRoomTask(task.id);
                  });
                }}
              >
                <Clock size={15} />
              </CardIcon>
              <CardIcon label="Set priority" active={flag?.pill.split(' ').find((c) => c.startsWith('text-'))} onClick={open('priority')}>
                <Flag size={15} fill={flag ? 'currentColor' : 'none'} />
              </CardIcon>
              <CardIcon label="Link to objective" active={task.objectiveId ? 'text-accent' : undefined} onClick={open('objective')}>
                <Target size={15} />
              </CardIcon>
              {task.seriesId && (
                <span className="px-0.5 text-ink-3" title="Repeats">
                  <Repeat size={13} aria-hidden />
                </span>
              )}
            </span>
          )}
          {rollover}
        </span>
        {channel && (
          <button type="button" onClick={open('channel')} aria-label={`Channel ${channel.name}`} className="flex min-w-0 items-center gap-0.5 rounded text-[12.5px] text-ink-2 hover:text-ink">
            <span className="font-semibold" style={{ color: channel.color }}>
              #
            </span>
            <span className="truncate">{channel.name}</span>
          </button>
        )}
      </div>
    </>
  );
}

const ACTION_LABEL: Record<TaskActionKind, string> = {
  actual: 'Actual time',
  planned: 'Planned time',
  channel: 'Channel',
  date: 'Move to',
  priority: 'Priority',
  objective: 'Weekly objective',
};

function ActionPicker({ task, kind, onDone }: { task: Task; kind: TaskActionKind; onDone: () => void }) {
  const then = (work: Promise<void>) => void work.finally(onDone);
  switch (kind) {
    case 'actual':
      // Time is logged against the day the card is on (today, for the backlog).
      return <TimePicker value={0} onPick={(m) => then(setActualForDay(task.id, task.day === BACKLOG ? today() : task.day, m))} clearLabel="No time tracked" />;
    case 'planned':
      return <TimePicker value={task.plannedMin} onPick={(m) => then(setPlannedTime(task.id, m))} />;
    case 'channel':
      return <ChannelPicker value={task.channelId} onPick={(id) => then(setChannel(task.id, id))} />;
    case 'date':
      return <DatePicker onPick={(day) => then(moveTask(task.id, day))} />;
    case 'objective':
      return <ObjectivePicker value={task.objectiveId} onPick={(id) => then(linkTask(task.id, id))} />;
    case 'priority':
      return task.day === BACKLOG ? (
        <BacklogPriorityPicker onPick={(p) => then(setBacklogPriority(task.id, p))} />
      ) : (
        <PriorityPicker onPick={(p) => then(setDailyPriority(task.id, p))} />
      );
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
  const navigate = useNavigate();
  // A ritual's card is a record of it; clicking goes back to that ritual.
  const openRitual = (card: Task) => {
    if (card.title === PLANNING_CARD && card.day !== BACKLOG) void navigate({ to: '/plan', search: { date: card.day } });
    else if (card.title === WEEKLY_PLANNING_CARD) void navigate({ to: '/weekly/plan' });
    else if (card.title === WEEKLY_REVIEW_CARD) void navigate({ to: '/weekly/review' });
    else void navigate({ to: '/shutdown' });
  };

  return (
    <PopoverRoot open={actionKind !== null} onOpenChange={(next) => !next && closeAction()}>
      <PopoverAnchor asChild>
        <div
          ref={setNodeRef}
          style={{ transform: CSS.Translate.toString(transform), transition }}
          {...listeners}
          data-task-id={task.id}
          data-testid="task"
          data-selected={selected || undefined}
          onMouseEnter={() => setHovered(task.id)}
          // A card that appears under a resting pointer (after a drop, say) gets no enter event, so movement counts too.
          onMouseMove={() => useTaskFocus.getState().hoveredId !== task.id && setHovered(task.id)}
          onMouseLeave={() => useTaskFocus.getState().hoveredId === task.id && setHovered(null)}
          onClick={() => (task.kind === 'ritual' ? openRitual(task) : openTask(task.id))}
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
