import { useDroppable } from '@dnd-kit/core';
import { useToday } from '@/app/useToday';
import { Repeat, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { applyEventToSeries, convertEventToTask, createEvent, deleteEvent, deleteEventAndFollowing, makeEventRepeat, stopEventSeries, updateEvent } from '@/data/commands/events';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { describeRepeat } from '@/domain/recurrence';
import { format } from 'date-fns';
import { fromDay } from '@/domain/dates';
import { changeSession, removeSession, workingWindow } from '@/data/commands/sessions';
import { setTaskCompleted } from '@/data/commands/tasks';
import { useSchedule, useTracked } from '@/data/queries';
import { useNow } from '@/app/useNow';
import { useChannelMap, useSettings } from '@/data/ReferenceData';
import type { Repeat as RepeatRule, Task } from '@/data/types';
import { nowMinutes } from '@/domain/clock';
import { formatClock, weekdayOf, type Day } from '@/domain/dates';
import { shortDate, weekdayName } from '@/domain/dayLabels';
import { layoutLanes, snap, SNAP_MIN } from '@/domain/scheduling';
import { useUi } from '@/app/uiStore';
import { useDnd } from '@/features/task/dndStore';
import { useOpenTask } from '@/features/task/useOpenTask';
import { CheckCircle } from '@/ui/CheckCircle';
import { PopoverAnchor, PopoverContent, PopoverRoot } from '@/ui/Popover';
import { calendarDropId, DAY_MIN, minToPx, pxToMin } from './metrics';

type Block =
  | { kind: 'session'; id: string; day: Day; startMin: number; endMin: number; task: Task }
  | { kind: 'event'; id: string; day: Day; startMin: number; endMin: number; title: string; seriesId: string | null }
  | { kind: 'tracked'; id: string; day: Day; startMin: number; endMin: number; task: Task; running: boolean };

type DragMode = 'move' | 'resize-start' | 'resize-end' | 'create';

interface DragState {
  mode: DragMode;
  /** The block being moved or resized; null while drawing a new event. */
  target: { kind: 'session' | 'event'; id: string } | null;
  day: Day;
  startMin: number;
  endMin: number;
  /** False until the pointer has travelled far enough to count as a drag rather than a click. */
  moved: boolean;
}

interface Origin {
  x: number;
  y: number;
  startMin: number;
  endMin: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const GUTTER = 44;
const NEW_EVENT_SNAP = 15;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const REPEATS: { label: (day: Day) => string; repeat: (weekday: number) => RepeatRule }[] = [
  { label: () => 'Every day', repeat: () => ({ kind: 'daily', interval: 1, weekdays: [] }) },
  { label: () => 'Weekdays', repeat: () => ({ kind: 'weekdays', interval: 1, weekdays: [] }) },
  { label: (day) => `Every ${WEEKDAY_NAMES[weekdayOf(day)]}`, repeat: (weekday) => ({ kind: 'weekly', interval: 1, weekdays: [weekday] }) },
  { label: (day) => `Every other ${WEEKDAY_NAMES[weekdayOf(day)]}`, repeat: (weekday) => ({ kind: 'weekly', interval: 2, weekdays: [weekday] }) },
  { label: (day) => `Every month on the ${format(fromDay(day), 'do')}`, repeat: () => ({ kind: 'monthly', interval: 1, weekdays: [] }) },
  { label: (day) => `Every year on ${format(fromDay(day), 'MMMM d')}`, repeat: () => ({ kind: 'yearly', interval: 1, weekdays: [] }) },
];

const seriesButton = 'rounded px-1.5 py-1 text-left text-ink-2 hover:bg-hover hover:text-ink';

/** What a repeating event's occurrence can do to the rest of its series. */
function SeriesControls({ block, onClose }: { block: Extract<Block, { kind: 'event' }>; onClose: () => void }) {
  const series = useLiveQuery(() => (block.seriesId ? db.eventSeries.get(block.seriesId) : undefined), [block.seriesId]);
  const run = (work: () => Promise<unknown>) => {
    onClose();
    void work();
  };
  return (
    <div className="flex flex-col gap-0.5 border-t border-line pt-2 text-[12px]">
      <span className="flex items-center gap-1 px-1.5 pb-1 text-ink-3">
        <Repeat size={12} /> {series ? describeRepeat(series.repeat) : 'Repeats'}
      </span>
      <button type="button" className={seriesButton} onClick={() => run(() => applyEventToSeries(block.id))}>
        Apply to all upcoming
      </button>
      <button type="button" className={seriesButton} onClick={() => run(() => stopEventSeries(block.id))}>
        Stop after this
      </button>
      <button type="button" className={`${seriesButton} hover:!text-over`} onClick={() => run(() => deleteEventAndFollowing(block.id))}>
        Delete this and following
      </button>
    </div>
  );
}

function EventEditor({ block, timeLabel, onClose }: { block: Extract<Block, { kind: 'event' }>; timeLabel: string; onClose: () => void }) {
  const save = (title: string) => {
    const next = title.trim() || 'Untitled event';
    if (next !== block.title) void updateEvent(block.id, { title: next }, 'Rename event');
  };
  return (
    <div className="flex w-[232px] flex-col gap-2.5 p-3">
      <input
        autoFocus
        defaultValue={block.title}
        aria-label="Event title"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => save(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            save(e.currentTarget.value);
            onClose();
          }
        }}
        className="rounded-md border border-line bg-transparent px-2 py-1.5 text-[13.5px] outline-none focus:border-accent"
      />
      <span className="tabular text-[12px] text-ink-3">{timeLabel}</span>
      {block.seriesId ? (
        <SeriesControls block={block} onClose={onClose} />
      ) : (
        <select
          aria-label="Repeat"
          value=""
          onChange={(e) => {
            const choice = REPEATS[Number(e.target.value)];
            if (!choice) return;
            onClose();
            void makeEventRepeat(block.id, choice.repeat(weekdayOf(block.day)));
          }}
          className="h-7 rounded-md border border-line bg-surface px-1.5 text-[12.5px] text-ink-2"
        >
          <option value="">Does not repeat</option>
          {REPEATS.map((r, i) => (
            <option key={i} value={i}>
              {r.label(block.day)}
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between text-[12px]">
        <button
          type="button"
          onClick={() => {
            onClose();
            void convertEventToTask(block.id);
          }}
          className="rounded px-1.5 py-0.5 text-accent hover:bg-accent-soft"
        >
          Turn into task
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            void deleteEvent(block.id);
          }}
          className="rounded px-1.5 py-0.5 text-ink-2 hover:bg-hover hover:text-over"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface ColumnProps {
  day: Day;
  blocks: Block[];
  isToday: boolean;
  nowMin: number;
  drawing: DragState | null;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onBlockPointerDown: (e: React.PointerEvent, block: Exclude<Block, { kind: 'tracked' }>, mode: DragMode) => void;
  onEmptyPointerDown: (e: React.PointerEvent, day: Day) => void;
}

function DayColumn({ day, blocks, isToday, nowMin, drawing, editingId, onEdit, onBlockPointerDown, onEmptyPointerDown }: ColumnProps) {
  // Re-render when zooming; the pixel helpers read the same value.
  const hourPx = useUi((s) => s.hourPx);
  const settings = useSettings();
  const channels = useChannelMap();
  const ghost = useDnd((s) => (s.ghost?.day === day ? s.ghost : null));
  const { setNodeRef } = useDroppable({ id: calendarDropId(day) });
  const hours = workingWindow(settings, day);
  const clock = (min: number) => formatClock(min, settings.timeFormat);
  const laid = useMemo(() => layoutLanes(blocks), [blocks]);
  const openTask = useOpenTask();

  return (
    <div
      ref={setNodeRef}
      data-cal-day={day}
      onPointerDown={(e) => onEmptyPointerDown(e, day)}
      className="relative min-w-0 flex-1 border-l border-line"
      style={{
        height: minToPx(DAY_MIN),
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourPx - 1}px, var(--line) ${hourPx - 1}px, var(--line) ${hourPx}px)`,
      }}
    >
      {/* Outside working hours */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-panel/70" style={{ height: minToPx(hours.startMin) }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-panel/70" style={{ top: minToPx(hours.endMin) }} />

      {laid.map(({ item: block, lane, lanes }) => {
        const height = Math.max(minToPx(block.endMin - block.startMin) - 2, 15);
        const style = {
          top: minToPx(block.startMin),
          height,
          left: `calc(${(lane / lanes) * 100}% + 2px)`,
          width: `calc(${100 / lanes}% - 5px)`,
        };
        const range = `${clock(block.startMin)} – ${clock(block.endMin)}`;
        const handlesFor = (target: Exclude<Block, { kind: 'tracked' }>) => (
          <>
            <span className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize" onPointerDown={(e) => onBlockPointerDown(e, target, 'resize-start')} />
            <span className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize" onPointerDown={(e) => onBlockPointerDown(e, target, 'resize-end')} />
          </>
        );

        if (block.kind === 'tracked') {
          const color = block.task.channelId ? channels.get(block.task.channelId)?.color : undefined;
          const tracked = `${clock(block.startMin)} – ${block.running ? 'now' : clock(block.endMin)}`;
          return (
            <div
              key={block.id}
              data-testid="tracked"
              role="button"
              tabIndex={-1}
              aria-label={`Worked on ${block.task.title}, ${tracked}`}
              title={`Worked on ${block.task.title}, ${tracked}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => openTask(block.task.id)}
              className="tracked-block absolute cursor-pointer overflow-hidden rounded-md px-1.5 text-[12px] leading-tight"
              style={{ ...style, ...(color ? ({ '--tag': color } as React.CSSProperties) : {}) }}
            >
              <div className="flex items-center gap-1" style={{ height: Math.min(height, 20) }}>
                {block.running && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-over" aria-hidden />}
                <span className="min-w-0 flex-1 truncate font-medium">{block.task.title}</span>
              </div>
              {height >= 36 && <div className="tabular text-[11px] opacity-80">{tracked}</div>}
            </div>
          );
        }

        if (block.kind === 'session') {
          const done = block.task.completedAt !== null;
          const color = block.task.channelId ? channels.get(block.task.channelId)?.color : undefined;
          return (
            <div
              key={block.id}
              data-testid="session"
              aria-label={`${block.task.title}, ${range}`}
              onPointerDown={(e) => onBlockPointerDown(e, block, 'move')}
              className={`session-block group absolute cursor-grab touch-none overflow-hidden rounded-md px-1.5 text-[12px] leading-tight ${done ? 'opacity-55' : ''}`}
              style={{ ...style, ...(color ? ({ '--tag': color } as React.CSSProperties) : {}) }}
            >
              <div className="flex items-center gap-1.5" style={{ height: Math.min(height, 20) }}>
                {height >= 20 && (
                  <CheckCircle
                    size="sm"
                    checked={done}
                    onChange={(next) => void setTaskCompleted(block.task.id, next)}
                    label={done ? `Reopen ${block.task.title}` : `Complete ${block.task.title}`}
                  />
                )}
                <span className={`min-w-0 flex-1 truncate font-medium ${done ? 'line-through' : ''}`}>{block.task.title}</span>
              </div>
              {height >= 36 && <div className="tabular text-[11px] text-ink-2">{range}</div>}
              <button
                type="button"
                aria-label={`Remove ${block.task.title} from calendar`}
                onClick={() => void removeSession(block.id)}
                className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded bg-surface/80 text-ink-2 opacity-0 hover:text-over focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={11} />
              </button>
              {handlesFor(block)}
            </div>
          );
        }

        return (
          <PopoverRoot key={block.id} open={editingId === block.id} onOpenChange={(open) => !open && onEdit(null)}>
            <PopoverAnchor asChild>
              <div
                data-testid="event"
                aria-label={`${block.title}, ${range}`}
                onPointerDown={(e) => onBlockPointerDown(e, block, 'move')}
                className="event-block absolute cursor-grab touch-none overflow-hidden rounded-md px-1.5 text-[12px] leading-tight"
                style={style}
              >
                <div className="flex items-center" style={{ height: Math.min(height, 20) }}>
                  <span className="min-w-0 flex-1 truncate font-medium">{block.title}</span>
                </div>
                {height >= 36 && <div className="tabular text-[11px] text-ink-3">{range}</div>}
                {handlesFor(block)}
              </div>
            </PopoverAnchor>
            <PopoverContent side="left" label="Edit event">
              <EventEditor block={block} timeLabel={range} onClose={() => onEdit(null)} />
            </PopoverContent>
          </PopoverRoot>
        );
      })}

      {drawing && (
        <div
          className="ghost-block pointer-events-none absolute left-0.5 right-1 rounded-md px-1.5 text-[11px] font-medium"
          style={{ top: minToPx(drawing.startMin), height: minToPx(drawing.endMin - drawing.startMin) }}
        >
          {clock(drawing.startMin)} – {clock(drawing.endMin)}
        </div>
      )}
      {ghost && (
        <div
          data-testid="calendar-ghost"
          className="ghost-block pointer-events-none absolute left-0.5 right-1 rounded-md px-1.5 text-[11px] font-medium"
          style={{ top: minToPx(ghost.startMin), height: Math.max(minToPx(ghost.durationMin), 15) }}
        >
          {clock(ghost.startMin)}
        </div>
      )}

      {isToday && (
        <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: minToPx(nowMin) }} aria-hidden>
          <span className="-ml-1 h-2 w-2 rounded-full bg-over" />
          <span className="h-px flex-1 bg-over" />
        </div>
      )}
    </div>
  );
}

/**
 * A time grid for one or more days. Sessions and events can be moved and
 * resized, an event is drawn by dragging on empty space, and tasks dragged
 * from a list land here as sessions.
 */
export function TimeGrid({ days, showHeader = false }: { days: Day[]; showHeader?: boolean }) {
  useUi((s) => s.hourPx);
  const settings = useSettings();
  const schedule = useSchedule(days);
  const showTracked = useUi((s) => s.showTracked);
  const nowMs = useNow(30_000, showTracked);
  const tracked = useTracked(days, nowMs, showTracked);
  const openTask = useOpenTask();
  const current = useToday();
  const scroller = useRef<HTMLDivElement>(null);
  const origin = useRef<Origin | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nowMin, setNowMin] = useState(nowMinutes());

  const setDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  useEffect(() => {
    const timer = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Open on the start of the working day (or just before now, if that is earlier).
  const firstDay = days[0];
  useLayoutEffect(() => {
    const start = workingWindow(settings, firstDay).startMin;
    const anchor = days.includes(current) ? Math.min(start, nowMinutes()) : start;
    scroller.current?.scrollTo({ top: Math.max(0, minToPx(anchor - 30)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDay, days.length]);

  const blocks: Block[] = useMemo(() => {
    if (!schedule) return [];
    const list: Block[] = [
      ...schedule.sessions.map((s): Block => ({ kind: 'session', id: s.id, day: s.day, startMin: s.startMin, endMin: s.endMin, task: s.task })),
      ...schedule.events.map((e): Block => ({ kind: 'event', id: e.id, day: e.day, startMin: e.startMin, endMin: e.endMin, title: e.title, seriesId: e.seriesId ?? null })),
      ...tracked.map((t): Block => ({ kind: 'tracked', ...t })),
    ];
    // While a block is being dragged, show it where it would land.
    if (drag?.target && drag.moved) {
      return list.map((b) => (b.id === drag.target!.id ? { ...b, day: drag.day, startMin: drag.startMin, endMin: drag.endMin } : b));
    }
    return list;
  }, [schedule, drag, tracked]);

  const blocksByDay = useMemo(() => {
    const map = new Map<Day, Block[]>(days.map((d) => [d, []]));
    for (const block of blocks) map.get(block.day)?.push(block);
    return map;
  }, [blocks, days]);

  function dayAt(clientX: number): Day | null {
    for (const el of scroller.current?.querySelectorAll<HTMLElement>('[data-cal-day]') ?? []) {
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return el.dataset.calDay ?? null;
    }
    return null;
  }

  function onBlockPointerDown(e: React.PointerEvent, block: Exclude<Block, { kind: 'tracked' }>, mode: DragMode) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    e.stopPropagation();
    origin.current = { x: e.clientX, y: e.clientY, startMin: block.startMin, endMin: block.endMin };
    setDrag({ mode, target: { kind: block.kind, id: block.id }, day: block.day, startMin: block.startMin, endMin: block.endMin, moved: false });
  }

  function onEmptyPointerDown(e: React.PointerEvent, day: Day) {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    e.preventDefault();
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const anchor = clamp(Math.floor(pxToMin(y) / NEW_EVENT_SNAP) * NEW_EVENT_SNAP, 0, DAY_MIN - NEW_EVENT_SNAP);
    origin.current = { x: e.clientX, y: e.clientY, startMin: anchor, endMin: anchor + NEW_EVENT_SNAP };
    setDrag({ mode: 'create', target: null, day, startMin: anchor, endMin: anchor + NEW_EVENT_SNAP, moved: false });
  }

  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    const o = origin.current;
    if (!d || !o) return;
    const dy = e.clientY - o.y;
    if (!d.moved && Math.abs(dy) < 4 && Math.abs(e.clientX - o.x) < 4) return;
    const delta = pxToMin(dy);
    let { startMin, endMin, day } = d;

    if (d.mode === 'move') {
      const length = o.endMin - o.startMin;
      startMin = clamp(snap(o.startMin + delta), 0, DAY_MIN - length);
      endMin = startMin + length;
      day = dayAt(e.clientX) ?? d.day;
    } else if (d.mode === 'resize-end') {
      endMin = clamp(snap(o.endMin + delta), o.startMin + SNAP_MIN, DAY_MIN);
    } else if (d.mode === 'resize-start') {
      startMin = clamp(snap(o.startMin + delta), 0, o.endMin - SNAP_MIN);
    } else {
      const pointer = clamp(snap(o.startMin + delta, NEW_EVENT_SNAP), 0, DAY_MIN);
      startMin = Math.min(o.startMin, pointer);
      endMin = Math.max(o.startMin + NEW_EVENT_SNAP, pointer);
    }
    setDrag({ ...d, day, startMin, endMin, moved: true });
  };

  const onUp = (e: PointerEvent) => {
    const d = dragRef.current;
    setDrag(null);
    origin.current = null;
    if (!d) return;
    const span = { day: d.day, startMin: d.startMin, endMin: d.endMin };

    if (!d.target) {
      if (d.moved) void createEvent({ title: 'New event', ...span }).then((event) => setEditingId(event.id));
      return;
    }
    if (!d.moved) {
      // A click: open the task, or the event's editor.
      if (d.target.kind === 'event') return setEditingId(d.target.id);
      const session = schedule?.sessions.find((s) => s.id === d.target!.id);
      if (session) openTask(session.taskId);
      return;
    }
    if (d.target.kind === 'session') void changeSession(d.target.id, span, { reschedule: !e.shiftKey });
    else void updateEvent(d.target.id, span, 'Move event');
  };

  const handlers = useRef({ onMove, onUp });
  handlers.current = { onMove, onUp };
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => handlers.current.onMove(e);
    const up = (e: PointerEvent) => handlers.current.onUp(e);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  return (
    <div className="flex min-h-0 flex-1 select-none flex-col">
      {showHeader && (
        <div className="flex shrink-0 border-b border-line" style={{ paddingLeft: GUTTER }}>
          {days.map((day) => (
            <div key={day} className="min-w-0 flex-1 border-l border-line px-2 py-2">
              <span className={`text-[13px] font-semibold ${day === current ? 'text-accent' : 'text-ink'}`}>{weekdayName(day).slice(0, 3)}</span>{' '}
              <span className="text-[12px] text-ink-3">{shortDate(day)}</span>
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} data-testid="time-grid" data-hold-still className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: minToPx(DAY_MIN) }}>
          <div className="relative shrink-0" style={{ width: GUTTER }} aria-hidden>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
              <span key={hour} className="tabular absolute right-2 -translate-y-1/2 text-[10.5px] text-ink-3" style={{ top: minToPx(hour * 60) }}>
                {formatClock(hour * 60, settings.timeFormat).replace(':00', settings.timeFormat === '12h' ? '' : ':00')}
              </span>
            ))}
          </div>
          {days.map((day) => (
            <DayColumn
              key={day}
              day={day}
              blocks={blocksByDay.get(day) ?? []}
              isToday={day === current}
              nowMin={nowMin}
              drawing={drag?.mode === 'create' && drag.day === day && drag.moved ? drag : null}
              editingId={editingId}
              onEdit={setEditingId}
              onBlockPointerDown={onBlockPointerDown}
              onEmptyPointerDown={onEmptyPointerDown}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
